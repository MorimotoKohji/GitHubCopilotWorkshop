import os
from flask import Flask, jsonify, render_template, request
from progress import load_progress, add_session


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)

    # デフォルトのデータファイルパス
    app.config["DATA_FILE"] = os.path.join(os.path.dirname(__file__), "progress.json")

    if config:
        app.config.update(config)

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/progress", methods=["GET"])
    def get_progress():
        data = load_progress(app.config["DATA_FILE"])
        return jsonify(data)

    @app.route("/api/progress/add", methods=["POST"])
    def add_progress():
        body = request.get_json(silent=True) or {}
        minutes_raw = body.get("minutes", 25)
        try:
            minutes = int(minutes_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "minutes must be an integer"}), 400
        if minutes <= 0:
            return jsonify({"error": "minutes must be a positive integer"}), 400
        data = add_session(app.config["DATA_FILE"], minutes)

    return app


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "").lower() in ("1", "true", "yes", "on")
    create_app().run(debug=debug)
