"""Deploy the backend to a Hugging Face Docker Space.

Creates the Space if needed, stores secrets as Space secrets (never in the repo), and
uploads the backend folder; Hugging Face then builds the Dockerfile.

    uv run python deploy/hf_space.py --space <hf-username>/<space-name>

Reads from the environment or backend/.env:
    HF_TOKEN             Hugging Face token with write access
    PROD_DATABASE_URL    Hosted Postgres (pgvector), postgresql+psycopg://... scheme
    OPENAI_API_KEY       LLM provider key
    ADMIN_TOKEN          Protects destructive endpoints
    CORS_ORIGINS         JSON list of allowed frontend origins
"""

import argparse
import os
from pathlib import Path

from dotenv import dotenv_values
from huggingface_hub import HfApi

BACKEND_DIR = Path(__file__).resolve().parent.parent
SPACE_README = Path(__file__).with_name("space_readme.md")
# Copied into the Space as secrets, renamed where the app expects a different name.
SECRETS = {
    "DATABASE_URL": "PROD_DATABASE_URL",
    "OPENAI_API_KEY": "OPENAI_API_KEY",
    "ADMIN_TOKEN": "ADMIN_TOKEN",
}
VARIABLES = {"LLM_PROVIDER": "openai", "ENVIRONMENT": "production"}
IGNORE = [
    ".venv/*",
    "data/*",
    "evals/results/*",
    "**/__pycache__/*",
    ".pytest_cache/*",
    ".mypy_cache/*",
    ".ruff_cache/*",
    ".env",
    "deploy/*",
    "README.md",
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--space", required=True, help="<hf-username>/<space-name>")
    args = parser.parse_args()

    config = {**dotenv_values(BACKEND_DIR / ".env"), **os.environ}
    missing = [name for name in ["HF_TOKEN", *SECRETS.values()] if not config.get(name)]
    if missing:
        raise SystemExit(f"Missing settings: {', '.join(missing)}")

    api = HfApi(token=config["HF_TOKEN"])
    api.create_repo(args.space, repo_type="space", space_sdk="docker", exist_ok=True)
    for secret, source in SECRETS.items():
        api.add_space_secret(args.space, secret, str(config[source]))
    origins = config.get("CORS_ORIGINS") or '["https://aidocumentassistant.vercel.app"]'
    variables = {**VARIABLES, "CORS_ORIGINS": origins}
    for name, value in variables.items():
        api.add_space_variable(args.space, name, value)

    api.upload_file(
        path_or_fileobj=SPACE_README,
        path_in_repo="README.md",
        repo_id=args.space,
        repo_type="space",
    )
    api.upload_folder(
        folder_path=BACKEND_DIR,
        repo_id=args.space,
        repo_type="space",
        ignore_patterns=IGNORE,
        commit_message="Deploy backend",
    )
    owner, name = args.space.split("/")
    print(f"Deployed. Build logs: https://huggingface.co/spaces/{args.space}")
    print(f"API (once built): https://{owner}-{name}.hf.space/health".lower())


if __name__ == "__main__":
    main()
