import csv
import json
import textwrap
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PM_DIR = ROOT / "project-management"
CSV_DIR = PM_DIR / "google-sheets"
OUT = PM_DIR / "IntelliMailPilot_Project_Report_23-06-2026_to_25-06-2026.pdf"


def read_csv(name):
    with (CSV_DIR / name).open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def clean(text):
    text = "" if text is None else str(text)
    replacements = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2022": "-",
        "\u00a0": " ",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text.encode("latin-1", "replace").decode("latin-1")


def fmt_iso_date(value):
    if not value:
        return ""
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%d-%m-%Y")
    except ValueError:
        return value


class SimplePdf:
    def __init__(self):
        self.pages = []
        self.page = []
        self.width = 595
        self.height = 842
        self.margin = 44
        self.y = self.height - self.margin
        self.new_page()

    def new_page(self):
        if getattr(self, "page", None):
            self.pages.append(self.page)
        self.page = []
        self.y = self.height - self.margin

    def _escape(self, text):
        return clean(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    def text(self, value, x=None, size=10, leading=13, bold=False):
        if x is None:
            x = self.margin
        if self.y < self.margin + leading:
            self.new_page()
        font = "F2" if bold else "F1"
        self.page.append(f"BT /{font} {size} Tf {x} {self.y} Td ({self._escape(value)}) Tj ET")
        self.y -= leading

    def wrapped(self, value, width=92, size=10, leading=13, indent=0, bullet=False):
        prefix = "- " if bullet else ""
        lines = textwrap.wrap(clean(value), width=width, subsequent_indent="  " if bullet else "")
        if not lines:
            lines = [""]
        for i, line in enumerate(lines):
            self.text((prefix if i == 0 else "  ") + line, self.margin + indent, size, leading)

    def heading(self, value, size=16):
        if self.y < 90:
            self.new_page()
        self.y -= 8
        self.text(value, size=size, leading=size + 8, bold=True)
        self.line()

    def subheading(self, value):
        if self.y < 70:
            self.new_page()
        self.y -= 6
        self.text(value, size=12, leading=17, bold=True)

    def line(self):
        y = self.y + 4
        self.page.append(f"0.75 w {self.margin} {y} m {self.width - self.margin} {y} l S")
        self.y -= 8

    def kv(self, rows, key_width=165):
        for key, value in rows:
            if self.y < 52:
                self.new_page()
            self.text(clean(key), self.margin, size=9, leading=0, bold=True)
            self.wrapped(clean(value), width=68, size=9, leading=12, indent=key_width)
        self.y -= 4

    def save(self, path):
        if self.page:
            self.pages.append(self.page)
            self.page = []

        objects = []

        def add(obj):
            objects.append(obj)
            return len(objects)

        font1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        font2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
        page_ids = []
        content_ids = []

        for index, commands in enumerate(self.pages, start=1):
            footer = f"BT /F1 8 Tf {self.margin} 24 Td (IntelliMailPilot Project Report - Page {index}) Tj ET"
            stream = "\n".join(commands + [footer])
            content_ids.append(add(f"<< /Length {len(stream.encode('latin-1'))} >>\nstream\n{stream}\nendstream"))
            page_ids.append(None)

        pages_id_placeholder = len(objects) + len(self.pages) + 1
        for i, content_id in enumerate(content_ids):
            page_ids[i] = add(
                f"<< /Type /Page /Parent {pages_id_placeholder} 0 R /MediaBox [0 0 {self.width} {self.height}] "
                f"/Resources << /Font << /F1 {font1} 0 R /F2 {font2} 0 R >> >> /Contents {content_id} 0 R >>"
            )

        pages_id = add(f"<< /Type /Pages /Kids [{' '.join(f'{p} 0 R' for p in page_ids)}] /Count {len(page_ids)} >>")
        catalog_id = add(f"<< /Type /Catalog /Pages {pages_id} 0 R >>")

        pdf = ["%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"]
        offsets = [0]
        for i, obj in enumerate(objects, start=1):
            offsets.append(sum(len(part.encode("latin-1")) for part in pdf))
            pdf.append(f"{i} 0 obj\n{obj}\nendobj\n")
        xref = sum(len(part.encode("latin-1")) for part in pdf)
        pdf.append(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n")
        for offset in offsets[1:]:
            pdf.append(f"{offset:010d} 00000 n \n")
        pdf.append(f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref}\n%%EOF\n")
        path.write_bytes("".join(pdf).encode("latin-1"))


def main():
    state = json.loads((PM_DIR / "project_state.json").read_text(encoding="utf-8"))
    tasks = state["tasks"]
    metrics = state["projectMetrics"]
    weekly = read_csv("Weekly_Roadmap.csv")
    sprint = read_csv("Sprint_Tracker.csv")
    risks = read_csv("Risks_And_Blockers.csv")
    bugs = read_csv("Bug_Tracker.csv")
    productivity = read_csv("Team_Productivity.csv")

    completed = [t for t in tasks if t["Current Status"] == "Completed"]
    in_progress = [t for t in tasks if t["Current Status"] == "In Progress"]
    not_started = [t for t in tasks if t["Current Status"] == "Not Started"]
    critical_open = [t for t in tasks if t["Priority"] == "Critical" and t["Current Status"] != "Completed"]
    this_week_completed = productivity[0].get("This Week Completed", "")
    this_week_updated = productivity[0].get("This Week Updated", "")
    next_week_focus = productivity[0].get("Next Week Focus", "")

    pdf = SimplePdf()
    pdf.text("INTELLIMAIL PILOT", size=22, leading=28, bold=True)
    pdf.text("Project Report", size=18, leading=24, bold=True)
    pdf.text("Reporting Period: 23-06-2026 to 25-06-2026", size=11, leading=16)
    pdf.text("Generated: 25-06-2026", size=11, leading=16)
    pdf.text("Owner: Akshay / Full-stack", size=11, leading=16)
    pdf.y -= 12
    pdf.wrapped(
        "This report summarizes IntelliMailPilot progress from project baseline/start through the current tracker update. "
        "It is generated from the same project management source used for the Excel workbook and Google Sheets import tabs.",
        width=86,
        size=10,
        leading=14,
    )

    pdf.heading("Executive Summary")
    pdf.kv(
        [
            ("Project", metrics.get("Project Name")),
            ("Current Sprint", metrics.get("Current Sprint")),
            ("Current Status", metrics.get("Current Status")),
            ("Health Status", metrics.get("Health Status")),
            ("Overall Progress", f"{metrics.get('Overall Progress %')}%"),
            ("Target Completion", metrics.get("Target Date")),
            ("Evidence Baseline", f"{state['evidence']['pages']} pages, {state['evidence']['apiRouteFiles']} API route files, "
             f"{state['evidence']['apiOperations']} API operations, {state['evidence']['databaseModels']} database models"),
        ]
    )

    pdf.heading("Progress Snapshot")
    pdf.kv(
        [
            ("Completed Tasks", f"{len(completed)} ({', '.join(t['Task ID'] for t in completed)})"),
            ("In Progress Tasks", f"{len(in_progress)} ({', '.join(t['Task ID'] for t in in_progress)})"),
            ("Pending Tasks", f"{len(not_started)} roadmap tasks"),
            ("Frontend", f"{metrics.get('Frontend %')}%"),
            ("Backend", f"{metrics.get('Backend %')}%"),
            ("Database", f"{metrics.get('Database %')}%"),
            ("Testing", f"{metrics.get('Testing %')}%"),
            ("Deployment", f"{metrics.get('Deployment %')}%"),
        ]
    )

    pdf.heading("Completed Work")
    for task in completed:
        pdf.wrapped(
            f"{task['Task ID']} - {task['Task Description']} ({task['Completion %']}%). Output: {task['Expected Output']}",
            width=88,
            bullet=True,
        )

    pdf.heading("This Week Updates")
    pdf.subheading("Fully Completed")
    pdf.wrapped(this_week_completed, width=88)
    pdf.subheading("Updated / Active")
    pdf.wrapped(this_week_updated, width=88)

    pdf.heading("Current In-Progress Work")
    for task in in_progress[:18]:
        pdf.wrapped(
            f"{task['Task ID']} - {task['Project']} / {task['Module']}: {task['Task Description']} "
            f"({task['Completion %']}%, target {fmt_iso_date(task['Target Date'])})",
            width=88,
            bullet=True,
        )

    pdf.heading("Next Week Plan")
    pdf.wrapped(next_week_focus, width=88)
    pdf.subheading("Week 2 Roadmap")
    if len(weekly) > 1:
        pdf.kv(
            [
                ("Feature IDs", weekly[1].get("Feature")),
                ("Planned Hours", weekly[1].get("Planned Hours")),
                ("Target Date", weekly[1].get("Target Date")),
                ("Completion Target", weekly[1].get("Next Week Completion Target")),
                ("Planned Work", weekly[1].get("Next Week Planned")),
            ]
        )

    pdf.heading("Sprint Summary")
    for row in sprint:
        pdf.wrapped(
            f"{row.get('Sprint')} - Completed: {row.get('Completed')}, In Progress: {row.get('In Progress')}, "
            f"Pending: {row.get('Pending')}, Health: {row.get('Health Status')}, Readiness: {row.get('Release Readiness')}",
            width=88,
            bullet=True,
        )

    pdf.heading("Risks And Blockers")
    for risk in risks[:10]:
        pdf.wrapped(
            f"{risk.get('Risk Type')} ({risk.get('Severity')}): {risk.get('Description')} | Mitigation: {risk.get('Mitigation Plan')} | Status: {risk.get('Status')}",
            width=88,
            bullet=True,
        )

    pdf.heading("Open Bugs / Quality Items")
    for bug in bugs:
        pdf.wrapped(
            f"{bug.get('Bug ID')} - {bug.get('Module')} ({bug.get('Severity')}), ETA {bug.get('ETA')}: {bug.get('Status')}",
            width=88,
            bullet=True,
        )

    pdf.heading("Release Readiness")
    pdf.kv(
        [
            ("Release Readiness", "48%"),
            ("Confidence Level", "55%"),
            ("Ready For Deployment", "No"),
            ("Known Issues", "Missing ESLint config, missing automated product suites, incomplete viewport QA, unproven staging recovery"),
            ("Recommendation", "Continue Sprint 1 stabilization, complete quality gates, verify production build, and start automated QA before release decisions."),
        ]
    )

    pdf.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
