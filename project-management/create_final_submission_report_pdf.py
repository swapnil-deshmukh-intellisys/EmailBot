import csv
import json
import textwrap
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PM_DIR = ROOT / "project-management"
CSV_DIR = PM_DIR / "google-sheets"
OUT = PM_DIR / "IntelliMailPilot_Final_Project_Submission_Report.pdf"


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
        "â€”": "-",
        "Ã¢â‚¬â€": "-",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text.encode("latin-1", "replace").decode("latin-1")


def date_display(value):
    if not value:
        return ""
    for fmt in ("%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).strftime("%d-%m-%Y")
        except ValueError:
            pass
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

    def esc(self, text):
        return clean(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    def text(self, value, x=None, size=10, leading=13, bold=False):
        if x is None:
            x = self.margin
        if self.y < self.margin + leading:
            self.new_page()
        font = "F2" if bold else "F1"
        self.page.append(f"BT /{font} {size} Tf {x} {self.y} Td ({self.esc(value)}) Tj ET")
        self.y -= leading

    def wrapped(self, value, width=92, size=10, leading=13, indent=0, bullet=False):
        prefix = "- " if bullet else ""
        lines = textwrap.wrap(clean(value), width=width, subsequent_indent="  " if bullet else "")
        if not lines:
            lines = [""]
        for i, line in enumerate(lines):
            self.text((prefix if i == 0 else "  ") + line, self.margin + indent, size, leading)

    def heading(self, value, size=15):
        if self.y < 92:
            self.new_page()
        self.y -= 8
        self.text(value, size=size, leading=size + 7, bold=True)
        self.line()

    def subheading(self, value):
        if self.y < 70:
            self.new_page()
        self.y -= 5
        self.text(value, size=11, leading=16, bold=True)

    def line(self):
        y = self.y + 4
        self.page.append(f"0.7 w {self.margin} {y} m {self.width - self.margin} {y} l S")
        self.y -= 8

    def kv(self, rows, key_width=160):
        for key, value in rows:
            if self.y < 52:
                self.new_page()
            self.text(key, self.margin, size=9, leading=0, bold=True)
            self.wrapped(value, width=69, size=9, leading=12, indent=key_width)
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
            footer = f"BT /F1 8 Tf {self.margin} 24 Td (IntelliMailPilot Final Submission Report - Page {index}) Tj ET"
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


def task_summary(tasks, status):
    return [t for t in tasks if t.get("Current Status") == status]


def main():
    state = json.loads((PM_DIR / "project_state.json").read_text(encoding="utf-8"))
    metrics = state["projectMetrics"]
    tasks = state["tasks"]
    features = read_csv("Feature_Tracker.csv")
    weekly = read_csv("Weekly_Roadmap.csv")
    sprint = read_csv("Sprint_Tracker.csv")
    risks = read_csv("Risks_And_Blockers.csv")
    deployment = read_csv("Deployment_Tracker.csv")
    bugs = read_csv("Bug_Tracker.csv")
    productivity = read_csv("Team_Productivity.csv")

    completed = task_summary(tasks, "Completed")
    in_progress = task_summary(tasks, "In Progress")
    pending = task_summary(tasks, "Not Started")
    critical_pending = [t for t in tasks if t.get("Priority") == "Critical" and t.get("Current Status") != "Completed"]

    pdf = SimplePdf()
    pdf.text("INTELLIMAIL PILOT", size=22, leading=28, bold=True)
    pdf.text("Final Project Submission Report", size=18, leading=24, bold=True)
    pdf.text("Submission Date: 25-06-2026", size=11, leading=16)
    pdf.text("Project Start / Baseline Date: 23-06-2026", size=11, leading=16)
    pdf.text("Prepared For: IntelliMailPilot Project Stakeholders", size=11, leading=16)
    pdf.text("Prepared By: Akshay / Full-stack", size=11, leading=16)
    pdf.y -= 10
    pdf.wrapped(
        "This document is a professional project submission and handover report for the IntelliMailPilot / EmailBot platform. "
        "It summarizes the delivered product scope, technical implementation coverage, current completion status, known pending items, "
        "quality status, release readiness, and recommended next actions for project closure and production readiness.",
        width=86,
        leading=14,
    )

    pdf.heading("1. Project Overview")
    pdf.kv(
        [
            ("Project Name", metrics.get("Project Name", "IntelliMailPilot / EmailBot")),
            ("Owner", metrics.get("Owner", "Akshay / Full-stack")),
            ("Current Sprint", metrics.get("Current Sprint")),
            ("Current Status", metrics.get("Current Status")),
            ("Health Status", metrics.get("Health Status")),
            ("Overall Completion", f"{metrics.get('Overall Progress %')}%"),
            ("Target Completion", date_display(metrics.get("Target Date"))),
        ]
    )
    pdf.wrapped(
        "IntelliMailPilot is a full-stack email automation and campaign management platform covering authentication, client data management, "
        "draft/template workflows, campaign creation, campaign execution, sender account management, reporting, admin operations, productivity tools, "
        "and deployment planning.",
        width=88,
    )

    pdf.heading("2. Submitted Scope")
    scope_items = [
        "Role-based dashboard and workspace foundation",
        "Client data upload, validation, list management, duplicate handling, and restore workflow planning",
        "Drafts, templates, rich-text content preparation, preview, and file text extraction planning",
        "Campaign creation, preflight validation, scheduling, sending, and worker lifecycle coverage",
        "Sender email account connection workflows with SMTP and Microsoft Graph planning",
        "Unified mailbox, warm-up automation, reporting, billing, admin, and productivity modules",
        "Project management workbook, Google Sheets import pack, weekly summaries, and status reporting artifacts",
    ]
    for item in scope_items:
        pdf.wrapped(item, width=88, bullet=True)

    pdf.heading("3. Technical Baseline")
    evidence = state["evidence"]
    pdf.kv(
        [
            ("Frontend Pages", str(evidence.get("pages"))),
            ("API Route Files", str(evidence.get("apiRouteFiles"))),
            ("API Operations", str(evidence.get("apiOperations"))),
            ("Database Models", str(evidence.get("databaseModels"))),
            ("Automated Product Test Suites", str(evidence.get("automatedProductTestSuites"))),
            ("Source Owner", evidence.get("currentGitOwner")),
        ]
    )

    pdf.heading("4. Completion Summary")
    pdf.kv(
        [
            ("Completed Items", f"{len(completed)} tasks"),
            ("In Progress Items", f"{len(in_progress)} tasks"),
            ("Pending Items", f"{len(pending)} tasks"),
            ("Frontend Completion", f"{metrics.get('Frontend %')}%"),
            ("Backend Completion", f"{metrics.get('Backend %')}%"),
            ("Database Completion", f"{metrics.get('Database %')}%"),
            ("Testing Completion", f"{metrics.get('Testing %')}%"),
            ("Deployment Completion", f"{metrics.get('Deployment %')}%"),
        ]
    )

    pdf.subheading("Fully Completed Deliverables")
    for task in completed:
        pdf.wrapped(
            f"{task['Task ID']} - {task['Task Description']}. Output: {task['Expected Output']}.",
            width=88,
            bullet=True,
        )

    pdf.heading("5. Feature Completion Status")
    for row in features:
        pdf.wrapped(
            f"{row.get('Feature')}: Overall {row.get('Completion %')}% ({row.get('Overall Status')}). "
            f"Frontend {row.get('Frontend')}%, Backend {row.get('Backend')}%, Database {row.get('Database')}%, "
            f"API {row.get('API')}%, Testing {row.get('Testing')}%, Deployment {row.get('Deployment')}%.",
            width=88,
            bullet=True,
        )

    pdf.heading("6. Current Work And Pending Closure")
    pdf.subheading("In Progress Work")
    for task in in_progress:
        pdf.wrapped(
            f"{task['Task ID']} - {task['Project']} / {task['Module']}: {task['Task Description']} "
            f"({task['Completion %']}%, target {date_display(task['Target Date'])}).",
            width=88,
            bullet=True,
        )

    pdf.subheading("Critical Pending / Closure Items")
    for task in critical_pending[:12]:
        pdf.wrapped(
            f"{task['Task ID']} - {task['Task Description']} | Status: {task['Current Status']} | Dependency: {task['Dependencies']}",
            width=88,
            bullet=True,
        )

    pdf.heading("7. Weekly And Next-Week Handover Plan")
    if productivity:
        row = productivity[0]
        pdf.kv(
            [
                ("This Week Completed", row.get("This Week Completed")),
                ("This Week Updated", row.get("This Week Updated")),
                ("Next Week Focus", row.get("Next Week Focus")),
            ]
        )
    if len(weekly) > 1:
        pdf.subheading("Next Week Roadmap")
        pdf.kv(
            [
                ("Planned Work", weekly[1].get("Next Week Planned")),
                ("Completion Target", weekly[1].get("Next Week Completion Target")),
                ("Target Date", weekly[1].get("Target Date")),
            ]
        )

    pdf.heading("8. Sprint And Roadmap Position")
    for row in sprint:
        pdf.wrapped(
            f"{row.get('Sprint')}: {row.get('Features')} | Completed: {row.get('Completed')}, "
            f"In Progress: {row.get('In Progress')}, Pending: {row.get('Pending')}, "
            f"Testing: {row.get('Testing Status')}, Release Readiness: {row.get('Release Readiness')}, Health: {row.get('Health Status')}.",
            width=88,
            bullet=True,
        )

    pdf.heading("9. Testing, Quality And Release Readiness")
    pdf.kv(
        [
            ("Testing Status", "Manual evidence exists, but automated product test coverage is largely pending."),
            ("Quality Gates", "ESLint/build/test CI gates are planned but not yet fully evidenced."),
            ("Release Readiness", "48%"),
            ("Confidence Level", "55%"),
            ("Ready For Deployment", "No - additional QA, build verification, staging proof, and security review required."),
        ]
    )
    pdf.subheading("Open Quality Items")
    for bug in bugs:
        pdf.wrapped(
            f"{bug.get('Bug ID')} - {bug.get('Module')} ({bug.get('Severity')}): {bug.get('Status')} | ETA: {bug.get('ETA')}",
            width=88,
            bullet=True,
        )

    pdf.heading("10. Deployment And Environment Status")
    for row in deployment:
        pdf.wrapped(
            f"{row.get('Environment')}: Frontend {row.get('Frontend Version')}; Backend {row.get('Backend Version')}; "
            f"Database {row.get('Database Version')}; Status: {row.get('Status')}.",
            width=88,
            bullet=True,
        )

    pdf.heading("11. Risks And Mitigation")
    for risk in risks:
        pdf.wrapped(
            f"{risk.get('Risk Type')} ({risk.get('Severity')}): {risk.get('Description')} | "
            f"Mitigation: {risk.get('Mitigation Plan')} | Status: {risk.get('Status')}",
            width=88,
            bullet=True,
        )

    pdf.heading("12. Handover Notes")
    handover = [
        "Use GOOGLE_SHEETS_PROJECT_TRACKER.xlsx as the main Excel project tracker.",
        "Use project-management/google-sheets CSV files for importing individual tabs into Google Sheets.",
        "Keep Task IDs stable and append future tasks rather than overwriting historical completed work.",
        "Before production release, complete lint configuration, clean production build verification, automated QA strategy, security review, and staging deployment proof.",
        "Continue tracking actual hours, blockers, completion percentage, and acceptance evidence in the project tracker.",
    ]
    for item in handover:
        pdf.wrapped(item, width=88, bullet=True)

    pdf.heading("13. Submission Statement")
    pdf.wrapped(
        "The IntelliMailPilot project has been submitted with a complete project-management baseline, module inventory, tracker workbook, "
        "Google Sheets import pack, status summaries, weekly planning, and risk register. The product has substantial implemented scope, "
        "but final production closure requires completion of the remaining QA, security, build, and deployment-readiness tasks identified in this report.",
        width=88,
    )

    pdf.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
