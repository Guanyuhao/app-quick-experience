from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

Stage = Literal["alpha", "beta", "rc", "pre", "release"]
Platform = Literal["android", "ios"]


@dataclass(frozen=True)
class Repo:
    owner: str
    repo: str

    @property
    def full_name(self) -> str:
        return f"{self.owner}/{self.repo}"


@dataclass(frozen=True)
class Version:
    semver: str
    stage: Stage
    index: int
    tag_style: Literal["dot", "dash"] = "dot"

    @property
    def version_str(self) -> str:
        return f"{self.semver}-{self.stage}.{self.index}"

    @property
    def base_tag(self) -> str:
        if self.tag_style == "dash":
            return f"v{self.semver}-{self.stage}"
        return f"v{self.semver}.{self.stage}"

    @property
    def candidate_base_tags(self) -> list[str]:
        # 兼容历史：优先用 dot，但同时探测 dash（或反过来）
        dot = f"v{self.semver}.{self.stage}"
        dash = f"v{self.semver}-{self.stage}"
        if self.tag_style == "dash":
            return [dash, dot]
        return [dot, dash]


VERSION_INPUT_RE = re.compile(
    r"^v?(?P<semver>\d+\.\d+\.\d+)[.-](?P<stage>alpha|beta|rc|pre|release)(?:[.-](?P<idx>\d+))?$"
)
VERSION_FULL_RE = re.compile(
    r"^v?(?P<semver>\d+\.\d+\.\d+)[.-](?P<stage>alpha|beta|rc|pre|release)[.-](?P<idx>\d+)$"
)
GH_RELEASE_TAG_RE = re.compile(r"^v\d+\.\d+\.\d+[.-](alpha|beta|rc|pre|release)$")
GH_RELEASE_TAG_WITH_INDEX_RE = re.compile(r"^v\d+\.\d+\.\d+[.-](alpha|beta|rc|pre|release)[.-]\d+$")
MANAGED_ASSET_RE = re.compile(r"^(?P<app>.+)-(?P<stage>alpha|beta|rc|pre|release)\.(?P<idx>\d+)\.(?P<ext>apk|ipa)$")


def normalize_base_tag(tag: str) -> str:
    """
    允许传入：
    - v1.0.0.alpha / v1.0.0-alpha
    - v1.0.0-alpha.2 / v1.0.0.alpha.2（旧格式）
    最终返回基础 tag（不含 index）。
    """
    t = tag.strip()
    if not t.startswith("v"):
        t = f"v{t}"

    m = re.match(r"^v(?P<semver>\d+\.\d+\.\d+)[.-](?P<stage>alpha|beta|rc|pre|release)$", t)
    if m:
        sep = "." if "." in t else "-"
        return f"v{m.group('semver')}{sep}{m.group('stage')}"

    m2 = re.match(
        r"^v(?P<semver>\d+\.\d+\.\d+)[.-](?P<stage>alpha|beta|rc|pre|release)[.-]\d+$",
        t,
    )
    if m2:
        # 默认回写为 dot 风格；publish 时会探测仓库是否已有 dash
        return f"v{m2.group('semver')}.{m2.group('stage')}"

    return t


def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def prompt(msg: str, *, default: str | None = None) -> str:
    suffix = f" (default: {default})" if default is not None else ""
    value = input(f"{msg}{suffix}: ").strip()
    if value == "" and default is not None:
        return default
    return value


def prompt_bool(msg: str, *, default: bool = False) -> bool:
    d = "y" if default else "n"
    raw = prompt(f"{msg} [y/n]", default=d).lower().strip()
    return raw in {"y", "yes", "true", "1"}


def run_cmd(cmd: list[str], *, dry_run: bool) -> subprocess.CompletedProcess[str]:
    if dry_run:
        print(f"[dry-run] {' '.join(cmd)}")
        return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

    return subprocess.run(cmd, check=False, text=True, capture_output=True)


def ensure_ok(proc: subprocess.CompletedProcess[str], *, context: str) -> None:
    if proc.returncode == 0:
        return
    eprint(f"[error] {context}")
    if proc.stdout:
        eprint(proc.stdout.rstrip())
    if proc.stderr:
        eprint(proc.stderr.rstrip())
    raise SystemExit(proc.returncode)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, data: dict[str, Any], *, dry_run: bool) -> None:
    content = json.dumps(data, ensure_ascii=False, indent=2)
    if not content.endswith("\n"):
        content += "\n"
    if dry_run:
        print(f"[dry-run] write json: {path}")
        return
    path.write_text(content, encoding="utf-8")


def find_app(config: dict[str, Any], app_key: str) -> dict[str, Any]:
    key = app_key.strip().lower()
    for app in config.get("apps", []):
        if str(app.get("id", "")).strip().lower() == key:
            return app
        if str(app.get("name", "")).strip().lower() == key:
            return app
    raise SystemExit(f"找不到 App：{app_key}（按 id 或 name 匹配）")


def parse_version(raw: str) -> tuple[str, Stage, int | None]:
    text = raw.strip()
    m = VERSION_INPUT_RE.match(text)
    if not m:
        raise SystemExit("版本格式不合法。示例：1.0.0-alpha.2 或 1.0.0.beta.2 或 1.0.0-alpha")
    semver = m.group("semver")
    stage = m.group("stage")
    idx = m.group("idx")
    parsed_stage: Stage = stage  # type: ignore[assignment]
    return semver, parsed_stage, int(idx) if idx is not None else None


def collect_existing_indices(app: dict[str, Any], semver: str, stage: Stage) -> list[int]:
    entries: list[dict[str, Any]] = app.get("versions", {}).get(stage, [])
    indices: list[int] = []
    for entry in entries:
        v = str(entry.get("version", "")).strip()
        m = VERSION_FULL_RE.match(v)
        if not m:
            continue
        if m.group("semver") == semver and m.group("stage") == stage:
            indices.append(int(m.group("idx")))
    return indices


def expected_asset(app_id: str, stage: Stage, idx: int, ext: str) -> str:
    return f"{app_id}-{stage}.{idx}.{ext}"


def resolve_files(pattern: str) -> list[Path]:
    expanded = os.path.expanduser(pattern)
    matches = glob.glob(expanded, recursive=True)
    files = [Path(p).resolve() for p in matches if Path(p).is_file()]
    return sorted(set(files))


def classify_files(paths: list[Path]) -> dict[Platform, list[Path]]:
    out: dict[Platform, list[Path]] = {"android": [], "ios": []}
    for p in paths:
        suf = p.suffix.lower()
        if suf == ".apk":
            out["android"].append(p)
        elif suf == ".ipa":
            out["ios"].append(p)
    return out


def rename_to(path: Path, dest_name: str, *, dry_run: bool) -> Path:
    dest = path.with_name(dest_name)
    if path.resolve() == dest.resolve():
        return dest
    if dest.exists():
        raise SystemExit(f"目标文件已存在，避免覆盖：{dest}")
    if dry_run:
        print(f"[dry-run] rename: {path} -> {dest}")
        return dest
    shutil.move(str(path), str(dest))
    return dest


def gh_release_exists(repo: Repo, tag: str, *, dry_run: bool) -> bool:
    proc = run_cmd(["gh", "release", "view", tag, "--repo", repo.full_name], dry_run=dry_run)
    if dry_run:
        return False
    return proc.returncode == 0


def gh_create_release(repo: Repo, *, tag: str, title: str, notes: str, dry_run: bool) -> None:
    proc = run_cmd(
        [
            "gh",
            "release",
            "create",
            tag,
            "--repo",
            repo.full_name,
            "--title",
            title,
            "--notes",
            notes,
        ],
        dry_run=dry_run,
    )
    ensure_ok(proc, context=f"创建 release 失败：{repo.full_name} {tag}")


def gh_upload_assets(repo: Repo, *, tag: str, files: list[Path], dry_run: bool) -> None:
    if not files:
        return
    proc = run_cmd(
        [
            "gh",
            "release",
            "upload",
            tag,
            *[str(p) for p in files],
            "--repo",
            repo.full_name,
            "--clobber",
        ],
        dry_run=dry_run,
    )
    ensure_ok(proc, context=f"上传 assets 失败：{repo.full_name} {tag}")


def gh_list_releases(repo: Repo, *, dry_run: bool) -> list[dict[str, Any]]:
    """
    获取 release 列表。兼容旧版本 gh（不支持 --json），使用文本解析。
    输出格式：<title>\t<type>\t<tag>\t<date>
    """
    proc = run_cmd(
        [
            "gh",
            "release",
            "list",
            "--repo",
            repo.full_name,
            "--limit",
            "1000",
        ],
        dry_run=dry_run,
    )
    if dry_run:
        return []
    ensure_ok(proc, context=f"获取 release 列表失败：{repo.full_name}")
    
    # 解析文本输出：<title>\t<type>\t<tag>\t<date>
    releases: list[dict[str, Any]] = []
    for line in (proc.stdout or "").strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) >= 3:
            tag = parts[2].strip()
            releases.append({"tagName": tag})
    
    return releases


def gh_release_assets(repo: Repo, tag: str, *, dry_run: bool) -> list[dict[str, Any]]:
    proc = run_cmd(
        ["gh", "release", "view", tag, "--repo", repo.full_name, "--json", "assets"],
        dry_run=dry_run,
    )
    if dry_run:
        return []
    ensure_ok(proc, context=f"获取 release assets 失败：{repo.full_name} {tag}")
    payload = json.loads(proc.stdout or "{}")
    assets = payload.get("assets", [])
    if isinstance(assets, list):
        return [a for a in assets if isinstance(a, dict)]
    return []


def gh_delete_asset(repo: Repo, tag: str, asset_name: str, *, dry_run: bool) -> None:
    proc = run_cmd(
        [
            "gh",
            "release",
            "delete-asset",
            tag,
            asset_name,
            "--repo",
            repo.full_name,
            "--yes",
        ],
        dry_run=dry_run,
    )
    ensure_ok(proc, context=f"删除 asset 失败：{repo.full_name} {tag} {asset_name}")


def gh_delete_release(repo: Repo, *, tag: str, yes: bool, cleanup_tag: bool, dry_run: bool) -> None:
    cmd = ["gh", "release", "delete", tag, "--repo", repo.full_name]
    if yes:
        cmd.append("--yes")
    if cleanup_tag:
        cmd.append("--cleanup-tag")
    proc = run_cmd(cmd, dry_run=dry_run)
    ensure_ok(proc, context=f"删除 release 失败：{repo.full_name} {tag}")


def collect_valid_tags_from_config(config: dict[str, Any]) -> set[str]:
    tags: set[str] = set()
    for app in config.get("apps", []):
        versions = app.get("versions", {})
        if not isinstance(versions, dict):
            continue
        for stage in ("alpha", "beta", "rc", "pre", "release"):
            entries = versions.get(stage, [])
            if not isinstance(entries, list):
                continue
            for entry in entries:
                for platform in ("android", "ios"):
                    obj = entry.get(platform)
                    if isinstance(obj, dict):
                        tag = obj.get("tag")
                        if isinstance(tag, str) and tag.strip():
                            tags.add(normalize_base_tag(tag))
    return tags


def allowed_assets_by_base_tag(config: dict[str, Any]) -> dict[str, set[str]]:
    """
    从 apps.json 推导每个基础 tag 允许存在的资产文件名集合。
    - 基础 tag：v1.0.0.alpha / v1.0.0-alpha
    - 资产命名：{app_id}-{stage}.{idx}.{apk|ipa}
    """
    out: dict[str, set[str]] = {}

    for app in config.get("apps", []):
        app_id = str(app.get("id", "")).strip()
        if not app_id:
            continue

        versions = app.get("versions", {})
        if not isinstance(versions, dict):
            continue

        for stage in ("alpha", "beta", "rc", "pre", "release"):
            entries = versions.get(stage, [])
            if not isinstance(entries, list):
                continue

            for entry in entries:
                v_str = str(entry.get("version", "")).strip()
                m = VERSION_FULL_RE.match(v_str)
                if not m:
                    continue

                idx = int(m.group("idx"))
                parsed_stage: Stage = m.group("stage")  # type: ignore[assignment]

                # 基础 tag 优先从配置中的 platform.tag 读取；没有就回退推导
                tag_from_cfg: str | None = None
                for platform in ("android", "ios"):
                    obj = entry.get(platform)
                    if isinstance(obj, dict):
                        t = obj.get("tag")
                        if isinstance(t, str) and t.strip():
                            tag_from_cfg = t.strip()
                            break
                base = normalize_base_tag(tag_from_cfg or f"v{m.group('semver')}.{parsed_stage}")

                out.setdefault(base, set()).add(expected_asset(app_id, parsed_stage, idx, "apk"))
                out.setdefault(base, set()).add(expected_asset(app_id, parsed_stage, idx, "ipa"))

    return out


def normalize_assets_in_app(app: dict[str, Any]) -> bool:
    changed = False
    app_id = str(app.get("id", "")).strip()
    if not app_id:
        return changed

    versions = app.get("versions", {})
    if not isinstance(versions, dict):
        return changed

    for stage in ("alpha", "beta", "rc", "pre", "release"):
        entries = versions.get(stage, [])
        if not isinstance(entries, list):
            continue
        for entry in entries:
            v = str(entry.get("version", "")).strip()
            m = VERSION_FULL_RE.match(v)
            if not m:
                continue
            idx = int(m.group("idx"))
            parsed_stage: Stage = m.group("stage")  # type: ignore[assignment]

            android = entry.get("android")
            if isinstance(android, dict):
                want = expected_asset(app_id, parsed_stage, idx, "apk")
                cur = android.get("asset")
                if isinstance(cur, str) and cur.strip() != want:
                    android["asset"] = want
                    changed = True
                tag = android.get("tag")
                if isinstance(tag, str) and tag.strip():
                    base = normalize_base_tag(tag)
                    if base != tag.strip():
                        android["tag"] = base
                        changed = True

            ios = entry.get("ios")
            if isinstance(ios, dict):
                want = expected_asset(app_id, parsed_stage, idx, "ipa")
                cur = ios.get("asset")
                if isinstance(cur, str) and cur.strip() != want:
                    ios["asset"] = want
                    changed = True
                tag = ios.get("tag")
                if isinstance(tag, str) and tag.strip():
                    base = normalize_base_tag(tag)
                    if base != tag.strip():
                        ios["tag"] = base
                        changed = True

    return changed


def upsert_version_entry(
    app: dict[str, Any],
    *,
    v: Version,
    date_str: str,
    changelog: str,
    android_asset_name: str | None,
    ios_asset_name: str | None,
    ios_testflight: bool | None,
) -> None:
    versions = app.setdefault("versions", {})
    stage_list: list[dict[str, Any]] = versions.setdefault(v.stage, [])

    found_idx: int | None = None
    for i, entry in enumerate(stage_list):
        if str(entry.get("version", "")).strip() == v.version_str:
            found_idx = i
            break

    if found_idx is None:
        entry: dict[str, Any] = {"version": v.version_str, "date": date_str, "changelog": changelog}
        stage_list.insert(0, entry)
    else:
        entry = stage_list[found_idx]
        entry["date"] = date_str
        entry["changelog"] = changelog
        if found_idx != 0:
            stage_list.insert(0, stage_list.pop(found_idx))

    if android_asset_name is not None:
        entry["android"] = {"tag": v.base_tag, "asset": android_asset_name}
    if ios_asset_name is not None:
        ios_obj: dict[str, Any] = {"tag": v.base_tag, "asset": ios_asset_name}
        if ios_testflight is not None:
            ios_obj["testflight"] = ios_testflight
        entry["ios"] = ios_obj


def cmd_normalize(args: argparse.Namespace) -> None:
    config_path = Path(args.config).resolve()
    config = load_json(config_path)

    changed = False
    for app in config.get("apps", []):
        changed = normalize_assets_in_app(app) or changed

    if not changed:
        print("apps.json 无需修改（asset 已统一）")
        return

    dump_json(config_path, config, dry_run=args.dry_run)
    print("已规范化 apps.json 的 asset 命名")


def cmd_cleanup(args: argparse.Namespace) -> None:
    config_path = Path(args.config).resolve()
    config = load_json(config_path)

    app_key = args.app or prompt("输入 AppName（按 id 或 name）", default="boochat")
    app = find_app(config, app_key)

    gh_obj = app.get("github", {})
    if not isinstance(gh_obj, dict) or "owner" not in gh_obj or "repo" not in gh_obj:
        raise SystemExit("apps.json 中缺少 github.owner / github.repo")
    repo = Repo(owner=str(gh_obj["owner"]), repo=str(gh_obj["repo"]))

    valid = collect_valid_tags_from_config(config)
    allowed = allowed_assets_by_base_tag(config)
    releases = gh_list_releases(repo, dry_run=args.dry_run)

    to_delete_release_with_index: list[str] = []
    to_delete_release_not_in_config: list[str] = []
    to_delete_assets: list[tuple[str, str]] = []
    for r in releases:
        tag = str(r.get("tagName", "")).strip()
        if not tag:
            continue
        
        # 检查是否是版本相关的 tag（基础 tag 或带 index 的 tag）
        is_base_tag = bool(GH_RELEASE_TAG_RE.match(tag))
        is_tag_with_index = bool(GH_RELEASE_TAG_WITH_INDEX_RE.match(tag))
        
        if not is_base_tag and not is_tag_with_index:
            # 不是版本相关的 tag，跳过
            continue
        
        # 规范化为基础 tag
        base = normalize_base_tag(tag)
        
        # 如果 tag 带 index（不符合规范），应该清理
        if is_tag_with_index:
            to_delete_release_with_index.append(tag)
            continue
        
        # 如果基础 tag 不在 apps.json 中，应该清理
        if base not in valid:
            to_delete_release_not_in_config.append(tag)
            continue

        if not args.cleanup_assets:
            continue

        allowed_names = allowed.get(base, set())
        assets = gh_release_assets(repo, tag, dry_run=args.dry_run)
        for a in assets:
            name = str(a.get("name", "")).strip()
            if not name:
                continue
            # 只清理由本脚本管理的资产，避免误删其它附件
            if not MANAGED_ASSET_RE.match(name):
                continue
            if name not in allowed_names:
                to_delete_assets.append((tag, name))

    to_delete_release = to_delete_release_with_index + to_delete_release_not_in_config
    if not to_delete_release and not to_delete_assets:
        print("没有需要清理的 release/asset")
        return

    if to_delete_release_with_index:
        print("将删除以下 release（tag 不符合规范，带 index，应为基础 tag）：")
        for t in to_delete_release_with_index:
            base = normalize_base_tag(t)
            print(f"- {t} (应为: {base})")
    
    if to_delete_release_not_in_config:
        print("将删除以下 release（apps.json 中不存在这个基础 tag）：")
        for t in to_delete_release_not_in_config:
            print(f"- {t}")

    if to_delete_assets:
        print("将删除以下 asset（tag 存在，但 apps.json 没有对应 version）：")
        for t, name in to_delete_assets:
            print(f"- {t}: {name}")

    if not args.yes and not args.dry_run:
        if not prompt_bool("确认执行清理？", default=False):
            print("已取消")
            return

    for t in to_delete_release:
        gh_delete_release(repo, tag=t, yes=True, cleanup_tag=args.cleanup_tag, dry_run=args.dry_run)

    for t, name in to_delete_assets:
        gh_delete_asset(repo, t, name, dry_run=args.dry_run)
    print("清理完成")


def cmd_publish(args: argparse.Namespace) -> None:
    config_path = Path(args.config).resolve()
    config = load_json(config_path)

    app_key = args.app or prompt("输入 AppName（按 id 或 name）", default="boochat")
    app = find_app(config, app_key)

    gh_obj = app.get("github", {})
    if not isinstance(gh_obj, dict) or "owner" not in gh_obj or "repo" not in gh_obj:
        raise SystemExit("apps.json 中缺少 github.owner / github.repo")
    repo = Repo(owner=str(gh_obj["owner"]), repo=str(gh_obj["repo"]))

    app_id = str(app.get("id", "")).strip() or app_key
    app_name = str(app.get("name", "")).strip() or app_id

    raw_version = args.version or prompt("输入版本（如 1.0.0-alpha.2 / 1.0.0.beta.2）")
    semver, stage, idx = parse_version(raw_version)
    if idx is None:
        existing = collect_existing_indices(app, semver, stage)
        idx = (max(existing) + 1) if existing else 1

    v = Version(semver=semver, stage=stage, index=idx, tag_style=args.tag_style)

    files_pattern = args.files or prompt("输入上传文件 glob（如 release/boochat/**/*.{apk,ipa}）")
    paths = resolve_files(files_pattern)
    if not paths:
        raise SystemExit(f"没有匹配到文件：{files_pattern}")

    by_platform = classify_files(paths)
    if not by_platform["android"] and not by_platform["ios"]:
        raise SystemExit("未匹配到 .apk 或 .ipa 文件")

    notes = args.notes or prompt("输入 Release 说明（可写 \\n 表示换行）", default="")
    if "\\n" in notes:
        notes = notes.replace("\\n", "\n")
    date_str = args.date or dt.date.today().isoformat()

    android_asset_name: str | None = None
    ios_asset_name: str | None = None
    ios_testflight: bool | None = None

    renamed: list[Path] = []
    if by_platform["android"]:
        android_asset_name = expected_asset(app_id, v.stage, v.index, "apk")
        for p in by_platform["android"]:
            renamed.append(rename_to(p, android_asset_name, dry_run=args.dry_run))

    if by_platform["ios"]:
        ios_asset_name = expected_asset(app_id, v.stage, v.index, "ipa")
        for p in by_platform["ios"]:
            renamed.append(rename_to(p, ios_asset_name, dry_run=args.dry_run))
        if args.ios_testflight is None:
            ios_testflight = prompt_bool("iOS 是否 TestFlight 申请", default=False)
        else:
            ios_testflight = args.ios_testflight

    # 先探测仓库已有的基础 tag（dot/dash），避免重复创建
    base_tag = None
    for candidate in v.candidate_base_tags:
        if gh_release_exists(repo, candidate, dry_run=args.dry_run):
            base_tag = candidate
            break
    if base_tag is None:
        base_tag = v.candidate_base_tags[0]
        title = f"{app_name} {base_tag}"
        gh_create_release(repo, tag=base_tag, title=title, notes=notes, dry_run=args.dry_run)

    gh_upload_assets(repo, tag=base_tag, files=renamed, dry_run=args.dry_run)

    upsert_version_entry(
        app,
        v=Version(semver=v.semver, stage=v.stage, index=v.index, tag_style="dot")
        if base_tag and "." in base_tag
        else Version(semver=v.semver, stage=v.stage, index=v.index, tag_style="dash"),
        date_str=date_str,
        changelog=notes,
        android_asset_name=android_asset_name,
        ios_asset_name=ios_asset_name,
        ios_testflight=ios_testflight,
    )

    if args.normalize_assets:
        for app_obj in config.get("apps", []):
            normalize_assets_in_app(app_obj)

    dump_json(config_path, config, dry_run=args.dry_run)

    if args.cleanup:
        cmd_cleanup(
            argparse.Namespace(
                config=str(config_path),
                app=app_id,
                yes=args.yes,
                cleanup_tag=args.cleanup_tag,
                cleanup_assets=True,
                dry_run=args.dry_run,
            )
        )

    print(f"完成：{repo.full_name} {base_tag}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="apps.json + GitHub Release 发布/清理脚本")
    p.add_argument(
        "--config",
        default=str(Path("app/config/apps.json").resolve()),
        help="apps.json 路径",
    )
    p.add_argument("--dry-run", action="store_true", help="只打印计划，不实际执行")

    sub = p.add_subparsers(dest="cmd", required=True)

    pub = sub.add_parser("publish", help="发布：创建/更新 release + 上传 + 写回 apps.json")
    pub.add_argument("--app", help="App id 或 name（默认交互输入）")
    pub.add_argument("--version", help="版本（如 1.0.0-alpha.2 / 1.0.0.beta.2）")
    pub.add_argument("--files", help="上传文件 glob（支持 **）")
    pub.add_argument("--notes", help="release notes（支持 \\n）")
    pub.add_argument("--date", help="写入 apps.json 的 date（默认今天 YYYY-MM-DD）")
    pub.add_argument(
        "--ios-testflight",
        action="store_true",
        default=None,
        help="iOS 标记 testflight=true（未传则交互询问）",
    )
    pub.add_argument(
        "--no-ios-testflight",
        dest="ios_testflight",
        action="store_false",
        default=None,
        help="iOS 标记 testflight=false（未传则交互询问）",
    )
    pub.add_argument(
        "--cleanup",
        action="store_true",
        default=True,
        help="发布后清理 apps.json 不存在的 release（默认开启）",
    )
    pub.add_argument("--no-cleanup", dest="cleanup", action="store_false", help="不清理")
    pub.add_argument("--yes", action="store_true", help="清理时不再二次确认（危险）")
    pub.add_argument(
        "--cleanup-tag",
        action="store_true",
        default=True,
        help="删除 release 时同时删除 git tag（默认开启）",
    )
    pub.add_argument(
        "--no-cleanup-tag",
        dest="cleanup_tag",
        action="store_false",
        help="删除 release 时不删除 git tag",
    )
    pub.add_argument(
        "--normalize-assets",
        action="store_true",
        default=True,
        help="写回前顺手规范化整个 apps.json 的 asset（默认开启）",
    )
    pub.add_argument(
        "--no-normalize-assets",
        dest="normalize_assets",
        action="store_false",
        help="不规范化 apps.json 的 asset",
    )
    pub.add_argument(
        "--tag-style",
        choices=("dot", "dash"),
        default="dot",
        help="新建 release 时基础 tag 风格：dot=v1.0.0.alpha / dash=v1.0.0-alpha",
    )
    pub.set_defaults(func=cmd_publish)

    clean = sub.add_parser("cleanup", help="清理：删除 apps.json 不存在的 release")
    clean.add_argument("--app", help="App id 或 name（默认交互输入）")
    clean.add_argument("--yes", action="store_true", help="不再二次确认（危险）")
    clean.add_argument(
        "--cleanup-tag",
        action="store_true",
        default=True,
        help="删除 release 时同时删除 git tag（默认开启）",
    )
    clean.add_argument(
        "--no-cleanup-tag",
        dest="cleanup_tag",
        action="store_false",
        help="删除 release 时不删除 git tag",
    )
    clean.add_argument(
        "--cleanup-assets",
        action="store_true",
        default=True,
        help="tag 存在时，删除 apps.json 不存在的版本 asset（默认开启）",
    )
    clean.add_argument(
        "--no-cleanup-assets",
        dest="cleanup_assets",
        action="store_false",
        help="tag 存在时，不删除多余 asset",
    )
    clean.set_defaults(func=cmd_cleanup)

    norm = sub.add_parser("normalize", help="仅规范化 apps.json 的 asset 命名")
    norm.set_defaults(func=cmd_normalize)

    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    try:
        args.func(args)
    except KeyboardInterrupt:
        raise SystemExit(130) from None


if __name__ == "__main__":
    main()


