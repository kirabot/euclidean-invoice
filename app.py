from __future__ import annotations

from io import BytesIO
from pathlib import Path

from flask import Flask, jsonify, request, send_file
import qrcode
from qrcode.image.svg import SvgImage


app = Flask(__name__)
BASE_DIR = Path(__file__).resolve().parent


@app.route("/")
def index() -> object:
    return send_file(BASE_DIR / "invoice.html")


@app.route("/NazSkull.webp")
def logo() -> object:
    return send_file(BASE_DIR / "NazSkull.webp")


def _read_payload() -> str:
    if request.method == "GET":
        return request.args.get("data", "").strip()
    if request.is_json:
        payload = request.get_json(silent=True) or {}
        return str(payload.get("data", "")).strip()
    return request.form.get("data", "").strip()


def _build_qr_image(data: str, fmt: str) -> BytesIO:
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=6,
        border=1,
    )
    qr.add_data(data)
    qr.make(fit=True)

    buffer = BytesIO()
    if fmt == "svg":
        img = qr.make_image(image_factory=SvgImage)
        img.save(buffer)
        buffer.seek(0)
    else:
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(buffer, format="PNG")
        buffer.seek(0)
    return buffer


@app.route("/api/ips-qr", methods=["GET", "POST"])
def ips_qr() -> tuple:
    data = _read_payload()
    if not data:
        return jsonify({"error": "Missing IPS payload string."}), 400

    fmt = request.args.get("format", "png").lower()
    if fmt not in {"png", "svg"}:
        return jsonify({"error": "Unsupported format. Use png or svg."}), 400

    buffer = _build_qr_image(data, fmt)
    mimetype = "image/svg+xml" if fmt == "svg" else "image/png"
    return send_file(buffer, mimetype=mimetype)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
