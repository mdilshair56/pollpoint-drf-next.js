import io
import math
from html import escape

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from weasyprint import HTML


def _extract_user_full_name(user_obj, fallback="N/A"):
    """Safely extract full name whether user_obj is a User model instance, dict, or None."""
    if not user_obj:
        return fallback
    if isinstance(user_obj, dict):
        first = user_obj.get("first_name", "")
        last = user_obj.get("last_name", "")
        name = f"{first} {last}".strip()
        return name or user_obj.get("username", "") or fallback
    first = getattr(user_obj, "first_name", "")
    last = getattr(user_obj, "last_name", "")
    name = f"{first} {last}".strip()
    return name or getattr(user_obj, "username", "") or fallback


class PollReportGenerator:
    """
    Reusable report generator supporting:
      1. Excel spreadsheet (.xlsx) via openpyxl
      2. Visual branded PDF (.pdf) via WeasyPrint

    Fully decoupled from HTTP requests so it can be invoked:
      - Directly from API viewsets (downloads)
      - Inside background Celery worker tasks (automated email reports)
    """

    @staticmethod
    def generate_excel(result_data: dict) -> io.BytesIO:
        """
        Build a clean, readable raw poll report in Excel.
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "Poll Results"
        ws.sheet_view.showGridLines = False

        font_title = Font(name="Calibri", size=16, bold=True, color="FFFFFF")
        font_header = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
        font_bold = Font(name="Calibri", size=11, bold=True)
        font_regular = Font(name="Calibri", size=11)
        font_muted = Font(name="Calibri", size=10, italic=True, color="64748B")
        font_meta_label = Font(name="Calibri", size=10, bold=True, color="1E3A8A")

        fill_title = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        fill_header = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
        fill_meta_label = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")
        fill_alt_row = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

        thin_side = Side(border_style="thin", color="E2E8F0")
        border_cell = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

        # Poll details
        ws.merge_cells("A1:G1")
        cell_title = ws["A1"]
        cell_title.value = "POLL REPORT"
        cell_title.font = font_title
        cell_title.fill = fill_title
        cell_title.alignment = Alignment(vertical="center", horizontal="left")
        ws.row_dimensions[1].height = 30

        creator = result_data.get("created_by")
        creator_name = _extract_user_full_name(creator, fallback="N/A")
        status = str(result_data.get("status", "")).replace("_", " ").title() or "N/A"
        visibility = str(result_data.get("result_visibility", "")).replace("_", " ").title() or "N/A"

        metadata = [
            (3, 1, "Poll Name:", result_data.get("poll_name") or "N/A", 2, 7),
            (4, 1, "Description:", result_data.get("description") or "", 2, 7),
            (6, 1, "Created by:", creator_name, 2, 2),
            (6, 3, "Status:", status, 4, 4),
            (6, 5, "Visibility:", visibility, 6, 7),
            (7, 1, "Starts at:", str(result_data.get("starts_at") or "N/A")[:19].replace("T", " "), 2, 3),
            (7, 4, "Ends at:", str(result_data.get("ends_at") or "N/A")[:19].replace("T", " "), 5, 7),
        ]
        for row, label_col, label, value, value_start, value_end in metadata:
            label_cell = ws.cell(row=row, column=label_col, value=label)
            label_cell.font = font_meta_label
            label_cell.fill = fill_meta_label
            label_cell.alignment = Alignment(vertical="center")
            label_cell.border = border_cell
            if value_start != value_end:
                ws.merge_cells(
                    start_row=row,
                    start_column=value_start,
                    end_row=row,
                    end_column=value_end,
                )
            value_cell = ws.cell(row=row, column=value_start, value=value)
            value_cell.font = font_regular
            value_cell.alignment = Alignment(vertical="center", wrap_text=True)
            value_cell.border = border_cell
            if value_start != value_end:
                for col in range(value_start, value_end + 1):
                    ws.cell(row=row, column=col).border = border_cell

        ws.row_dimensions[3].height = 24
        ws.row_dimensions[4].height = 42
        ws.row_dimensions[6].height = 24
        ws.row_dimensions[7].height = 24

        # Results table
        headers = [
            "Question Number",
            "Questions",
            "Option Number",
            "Answer Option",
            "Vote count",
            "Percentage",
            "Voters",
        ]
        table_header_row = 9
        for col_idx, h_text in enumerate(headers, 1):
            cell = ws.cell(row=table_header_row, column=col_idx, value=h_text)
            cell.font = font_header
            cell.fill = fill_header
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = border_cell
        ws.row_dimensions[table_header_row].height = 30

        curr_row = table_header_row + 1
        questions = result_data.get("questions", [])
        for q_idx, q in enumerate(questions, 1):
            q_name = q.get("Question_name", "")
            options = q.get("answer_options", [])
            total_q_votes = sum(len(opt.get("voters", [])) for opt in options)

            for opt_idx, opt in enumerate(options, 1):
                voters = opt.get("voters", [])
                voters_count = len(voters)
                pct = voters_count / total_q_votes if total_q_votes > 0 else 0.0
                voter_names = ", ".join(
                    _extract_user_full_name(v, fallback="").strip()
                    for v in voters
                    if _extract_user_full_name(v, fallback="").strip()
                )

                values = [
                    q_idx if opt_idx == 1 else "",
                    q_name if opt_idx == 1 else "",
                    opt_idx,
                    opt.get("name", ""),
                    voters_count,
                    pct,
                    voter_names or "None",
                ]
                for col_idx, value in enumerate(values, 1):
                    c = ws.cell(row=curr_row, column=col_idx)
                    c.value = value
                    if col_idx in (1, 2) and opt_idx == 1:
                        c.font = font_bold
                    elif col_idx == 7 and not voters:
                        c.font = font_muted
                    else:
                        c.font = font_regular
                    c.alignment = Alignment(
                        horizontal="center" if col_idx in (1, 3, 5, 6) else "left",
                        vertical="top",
                        wrap_text=True,
                    )
                    c.border = border_cell
                    if (curr_row - table_header_row) % 2 == 0:
                        c.fill = fill_alt_row
                ws.cell(row=curr_row, column=6).number_format = "0.0%"
                ws.row_dimensions[curr_row].height = 30 if voter_names else 22

                curr_row += 1

            if not options:
                for col_idx, value in enumerate([q_idx, q_name, "", "", 0, 0, "None"], 1):
                    cell = ws.cell(row=curr_row, column=col_idx, value=value)
                    cell.font = font_bold if col_idx in (1, 2) else font_regular
                    cell.alignment = Alignment(
                        horizontal="center" if col_idx in (1, 3, 5, 6) else "left",
                        vertical="top",
                        wrap_text=True,
                    )
                    cell.border = border_cell
                    if (curr_row - table_header_row) % 2 == 0:
                        cell.fill = fill_alt_row
                    if col_idx == 6:
                        cell.number_format = "0.0%"
                ws.row_dimensions[curr_row].height = 22
                curr_row += 1

        column_widths = [17, 38, 16, 34, 14, 14, 48]
        for col_idx, width in enumerate(column_widths, 1):
            ws.column_dimensions[chr(64 + col_idx)].width = width
        ws.freeze_panes = f"A{table_header_row + 1}"
        if curr_row > table_header_row + 1:
            ws.auto_filter.ref = f"A{table_header_row}:G{curr_row - 1}"

        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        return stream

    @staticmethod
    def generate_pdf(result_data: dict, include_voters: bool = True) -> io.BytesIO:
        """
        Build a branded PDF report with a vote distribution chart for each question.
        """
        poll_name = escape(str(result_data.get("poll_name") or "Untitled poll"))
        poll_id = escape(str(result_data.get("poll_id", "")))
        description = escape(str(result_data.get("description") or "No description provided."))
        status = escape(str(result_data.get("status", "")).replace("_", " ").title() or "N/A")
        visibility = escape(
            str(result_data.get("result_visibility", "")).replace("_", " ").title() or "N/A"
        )
        starts_at = escape(str(result_data.get("starts_at") or "N/A")[:16].replace("T", " "))
        ends_at = escape(str(result_data.get("ends_at") or "N/A")[:16].replace("T", " "))

        creator = result_data.get("created_by")
        creator_name = escape(_extract_user_full_name(creator, fallback="User"))

        questions_html = []
        chart_colors = ["#2563EB", "#7C3AED", "#059669", "#EA580C", "#DB2777", "#0891B2", "#CA8A04"]
        for q_idx, q in enumerate(result_data.get("questions", []), 1):
            q_name = escape(str(q.get("Question_name") or "Untitled question"))
            options = q.get("answer_options", [])
            total_votes = sum(len(opt.get("voters", [])) for opt in options)

            sorted_opts = sorted(options, key=lambda o: len(o.get("voters", [])), reverse=True)

            opts_rows = []
            legend_rows = []
            pie_slices = []
            current_angle = -90.0
            for rank, opt in enumerate(sorted_opts, 1):
                voters = opt.get("voters", [])
                votes = len(voters)
                share = votes / total_votes if total_votes > 0 else 0.0
                pct = round(share * 100, 1)
                color = chart_colors[(rank - 1) % len(chart_colors)]
                option_name = escape(str(opt.get("name") or "Unnamed option"))

                if votes:
                    end_angle = current_angle + share * 360
                    if votes == total_votes:
                        pie_slices.append(
                            f'<circle cx="50" cy="50" r="45" fill="{color}" />'
                        )
                    else:
                        start_x = 50 + 45 * math.cos(math.radians(current_angle))
                        start_y = 50 + 45 * math.sin(math.radians(current_angle))
                        end_x = 50 + 45 * math.cos(math.radians(end_angle))
                        end_y = 50 + 45 * math.sin(math.radians(end_angle))
                        large_arc = 1 if end_angle - current_angle > 180 else 0
                        pie_slices.append(
                            f'<path d="M 50 50 L {start_x:.3f} {start_y:.3f} '
                            f'A 45 45 0 {large_arc} 1 {end_x:.3f} {end_y:.3f} Z" '
                            f'fill="{color}" stroke="#FFFFFF" stroke-width="1.5" />'
                        )
                    current_angle = end_angle

                legend_rows.append(
                    f'<li><span class="legend-swatch" style="background:{color};"></span>'
                    f'<span class="legend-name">{option_name}</span>'
                    f'<span class="legend-value">{pct:.1f}%</span></li>'
                )

                voters_list_html = ""
                if include_voters and voters:
                    names = escape(
                        ", ".join(
                            _extract_user_full_name(v, fallback="").strip()
                            for v in voters
                            if _extract_user_full_name(v, fallback="").strip()
                        )
                    )
                    voters_list_html = f'<div class="voters-box"><strong>Voters ({votes}):</strong> {names}</div>'
                elif include_voters:
                    voters_list_html = '<div class="voters-box text-muted">No voters for this option</div>'

                opts_rows.append(f"""
                <div class="option-row">
                    <div class="option-header">
                        <span class="rank">#{rank}</span>
                        <span class="option-name">{option_name}</span>
                        <span class="option-stats">{votes} votes ({pct}%)</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: {max(pct, 2.0)}%; background:{color};"></div>
                    </div>
                    {voters_list_html}
                </div>
                """)

            if not sorted_opts:
                pie_slices.append('<circle cx="50" cy="50" r="45" fill="#E2E8F0" />')
                legend_rows.append('<li class="empty-legend">No answer options</li>')
            elif total_votes == 0:
                pie_slices.append('<circle cx="50" cy="50" r="45" fill="#E2E8F0" />')

            if not opts_rows:
                opts_rows.append('<p class="empty-options">No answer options are available.</p>')

            vote_label = "vote" if total_votes == 1 else "votes"
            questions_html.append(f"""
            <div class="question-card">
                <div class="question-title">
                    <span class="q-badge">Q{q_idx}</span>
                    <h3>{q_name}</h3>
                    <span class="q-total">{total_votes} {vote_label}</span>
                </div>
                <div class="question-summary">
                    <div class="pie-wrap">
                        <svg class="pie-chart" viewBox="0 0 100 100" role="img"
                            aria-label="Answer option vote distribution">
                            {"".join(pie_slices)}
                        </svg>
                    </div>
                    <ul class="chart-legend">
                        {"".join(legend_rows)}
                    </ul>
                </div>
                <div class="options-container">
                    {"".join(opts_rows)}
                </div>
            </div>
            """)

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Poll Analytics Report - #{poll_id}</title>
            <style>
                @page {{
                    size: A4;
                    margin: 1.5cm;
                    @bottom-right {{
                        content: "Page " counter(page) " of " counter(pages);
                        font-family: Arial, sans-serif;
                        font-size: 9pt;
                        color: #64748b;
                    }}
                }}
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    color: #0f172a;
                    background-color: #ffffff;
                    margin: 0;
                    padding: 0;
                    font-size: 10pt;
                }}
                /* Luxury Midnight Header Banner */
                .banner {{
                    background: linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%);
                    color: #ffffff;
                    border-radius: 16px;
                    padding: 24px;
                    margin-bottom: 24px;
                }}
                .banner-top {{
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }}
                .badge {{
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 8px;
                    font-size: 8pt;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-right: 6px;
                }}
                .badge-poll {{ background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }}
                .badge-status {{ background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.3); }}
                .badge-vis {{ background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3); }}
                .dates {{
                    font-size: 8.5pt;
                    color: #cbd5e1;
                    text-align: right;
                }}
                .dates strong {{ color: #ffffff; }}
                h1 {{
                    font-size: 18pt;
                    font-weight: 800;
                    margin: 8px 0;
                    color: #ffffff;
                }}
                .desc {{
                    font-size: 9.5pt;
                    color: #cbd5e1;
                    margin: 6px 0 16px 0;
                    line-height: 1.4;
                }}
                .creator-pill {{
                    display: inline-block;
                    background: #0f172a;
                    border: 1px solid #334155;
                    border-radius: 20px;
                    padding: 4px 12px;
                    font-size: 8.5pt;
                    color: #cbd5e1;
                }}
                .creator-pill strong {{ color: #ffffff; }}

                /* Questions Breakdown */
                .question-card {{
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 14px;
                    padding: 18px;
                    margin-bottom: 20px;
                    page-break-inside: avoid;
                }}
                .question-title {{
                    display: flex;
                    align-items: center;
                    border-bottom: 1px solid #f1f5f9;
                    padding-bottom: 10px;
                    margin-bottom: 14px;
                }}
                .q-badge {{
                    background: #eff6ff;
                    color: #2563eb;
                    font-weight: bold;
                    border-radius: 8px;
                    padding: 4px 8px;
                    font-size: 9pt;
                    margin-right: 10px;
                }}
                h3 {{
                    font-size: 12pt;
                    margin: 0;
                    flex-grow: 1;
                    color: #0f172a;
                }}
                .q-total {{
                    font-size: 8.5pt;
                    font-weight: bold;
                    color: #64748b;
                }}
                .question-summary {{
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 12px;
                    margin-bottom: 14px;
                }}
                .pie-wrap {{
                    width: 72px;
                    height: 72px;
                    flex-shrink: 0;
                }}
                .pie-chart {{
                    width: 100%;
                    height: 100%;
                    display: block;
                }}
                .chart-legend {{
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px 14px;
                    font-size: 8.5pt;
                    color: #334155;
                }}
                .chart-legend li {{
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }}
                .legend-swatch {{
                    width: 10px;
                    height: 10px;
                    border-radius: 2px;
                    display: inline-block;
                    flex-shrink: 0;
                }}
                .legend-name {{
                    max-width: 180px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }}
                .legend-value {{
                    font-weight: bold;
                    color: #0f172a;
                }}
                .empty-legend, .empty-options {{
                    color: #94a3b8;
                    font-style: italic;
                    font-size: 8.5pt;
                    margin: 0;
                }}
                .option-row {{
                    margin-bottom: 12px;
                }}
                .option-header {{
                    display: flex;
                    justify-content: space-between;
                    font-size: 9pt;
                    margin-bottom: 4px;
                }}
                .rank {{
                    font-weight: bold;
                    color: #64748b;
                    margin-right: 6px;
                }}
                .option-name {{
                    font-weight: 600;
                    color: #1e293b;
                    flex-grow: 1;
                }}
                .option-stats {{
                    font-weight: bold;
                    color: #2563eb;
                }}
                .bar-container {{
                    height: 12px;
                    background: #f1f5f9;
                    border-radius: 6px;
                    overflow: hidden;
                    margin-bottom: 4px;
                }}
                .bar-fill {{
                    height: 100%;
                    border-radius: 6px;
                }}
                .voters-box {{
                    font-size: 7.5pt;
                    color: #475569;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 4px 8px;
                    margin-top: 3px;
                }}
                .text-muted {{ color: #94a3b8; font-style: italic; }}
            </style>
        </head>
        <body>
            <div class="banner">
                <div class="banner-top">
                    <div>
                        <span class="badge badge-poll">POLL #{poll_id}</span>
                        <span class="badge badge-status">{status}</span>
                        <span class="badge badge-vis">{visibility}</span>
                    </div>
                    <div class="dates">
                        <div>Starts: <strong>{starts_at}</strong></div>
                        <div>Ends: <strong>{ends_at}</strong></div>
                    </div>
                </div>
                <h1>{poll_name}</h1>
                <p class="desc">{description}</p>
                <div class="creator-pill">
                    Created by: <strong>{creator_name}</strong>
                </div>
            </div>

            {"".join(questions_html)}
        </body>
        </html>
        """

        pdf_bytes = HTML(string=html_content).write_pdf()
        stream = io.BytesIO(pdf_bytes)
        stream.seek(0)
        return stream
