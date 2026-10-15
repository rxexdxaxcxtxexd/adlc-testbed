"""Create two fictional certificates for the direction studies."""
import base64
import json
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parent
sample = json.loads((ROOT / "sample-data-r2.json").read_text(encoding="utf-8"))
out = ROOT / "certificates"
out.mkdir(exist_ok=True)
encoded = {}
for key, record in sample["records"].items():
    path = out / f"{key}-sample.pdf"
    doc = canvas.Canvas(str(path), pagesize=(612, 792), invariant=1)
    doc.setTitle("SAMPLE: fictional certificate")
    doc.setAuthor("Harborline Builders (fictional)")
    doc.setSubject("Generic certificate layout. All names and values are fictional.")
    doc.setFillColor(HexColor("#f8f3e8"))
    doc.rect(0, 0, 612, 792, fill=1, stroke=0)
    doc.setFillColor(HexColor("#273630"))
    doc.setFont("Helvetica-Bold", 10)
    doc.drawString(42, 751, "SAMPLE: fictional certificate")
    doc.setFont("Helvetica", 9)
    doc.drawRightString(570, 751, "All names and values are fictional")
    doc.setStrokeColor(HexColor("#6a7567"))
    doc.line(42, 734, 570, 734)
    doc.setFont("Times-Roman", 28)
    doc.drawString(42, 696, "Certificate of insurance")
    doc.setFont("Helvetica", 10)
    doc.drawString(42, 675, "Generic certificate-style layout")
    def label(y, heading, value):
        doc.setFillColor(HexColor("#596153"))
        doc.setFont("Helvetica", 8)
        doc.drawString(42, y, heading.upper())
        doc.setFillColor(HexColor("#273630"))
        doc.setFont("Helvetica-Bold", 11)
        doc.drawString(42, y - 19, value)
    label(636, "Insured", record["values"]["insuredName"])
    label(591, "Certificate holder", sample["firm"])
    label(546, "Project", record["project"] + ", " + record["address"])
    doc.setFont("Helvetica", 9)
    doc.drawString(42, 497, "Issued by Fairhaven Insurance Agency (fictional)")
    doc.drawString(42, 481, "Insurer: Pinecrest Assurance (fictional)")
    doc.drawString(42, 465, "Expires " + record["expiry"])
    doc.setStrokeColor(HexColor("#6a7567"))
    doc.line(42, 445, 570, 445)
    doc.setFont("Helvetica-Bold", 9)
    doc.drawString(42, 427, "COVERAGE")
    doc.drawRightString(570, 427, "LIMIT")
    y = 397
    for field, name, required in sample["limits"]:
        if field == "pol" and not record["pollution"]:
            continue
        value = 1000000 if key == "brightway" and field == "glOcc" else record["values"][field]
        doc.setFont("Helvetica", 11)
        doc.drawString(42, y, name)
        doc.setFont("Courier", 11)
        doc.drawRightString(570, y, "$" + format(value, ","))
        doc.setStrokeColor(HexColor("#d1d4c5"))
        doc.line(42, y - 12, 570, y - 12)
        y -= 32
    y -= 17
    doc.setFillColor(HexColor("#273630"))
    doc.setFont("Helvetica-Bold", 9)
    doc.drawString(42, y, "ENDORSEMENTS AND NOTES")
    doc.setFont("Helvetica", 10)
    for text in [
        "Harborline Builders is named as additional insured by endorsement.",
        "30 days written notice of cancellation to the certificate holder.",
        "This document shows fictional sample coverage only.",
    ]:
        y -= 21
        doc.drawString(42, y, text)
    doc.setFont("Helvetica", 8)
    doc.setFillColor(HexColor("#596153"))
    doc.drawString(42, 50, "Source: sample certificate | Issued Oct 8, 2026 | Sample data")
    doc.showPage()
    doc.save()
    encoded[key] = base64.b64encode(path.read_bytes()).decode("ascii")
(ROOT / "pdf-data-r2.js").write_text(
    "/* Embedded sample PDFs let the studies open directly from disk. */\n"
    "window.STUDY_PDFS = " + json.dumps(encoded) + ";\n", encoding="utf-8"
)
print("Created two fictional PDFs and their embedded preview data.")
