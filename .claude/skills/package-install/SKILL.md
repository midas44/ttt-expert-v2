---
name: package-install
description: >
  Install software packages on this Ubuntu machine using any package manager: apt, npm, pip3,
  curl-based installers (bun, nvm, rustup, etc.), or snap. Use this skill when the user asks
  to install anything, mentions "install", "apt install", "npm install", "pip install",
  "pip3 install", "curl install", "bun install", "snap install", or encounters installation
  errors like network timeouts, proxy errors, permission denied, or unsupported engine
  warnings. Also use when the user asks to upgrade Node.js, install global CLI tools, or
  troubleshoot failed installations.
---

# Package Installation on This Machine

## Proxy Requirement

This machine accesses the internet through a local proxy. **All package managers need proxy configuration** or downloads will fail with "network unreachable" / "connection timeout" errors.

- **Proxy address**: `http://127.0.0.1:2080`

### Set proxy globally (recommended before any install session)

```bash
export HTTP_PROXY=http://127.0.0.1:2080
export HTTPS_PROXY=http://127.0.0.1:2080
```

This covers most tools (curl, npm, pip3, wget, etc.) for the current shell session.

---

## apt (system packages)

apt uses its own proxy config, not environment variables.

```bash
# One-time install with proxy
sudo apt -o Acquire::http::Proxy="http://127.0.0.1:2080" install <package>

# Or just use sudo apt install if system apt proxy is already configured
sudo apt install <package>
```

### Examples

```bash
sudo apt install unzip curl git build-essential
```

---

## npm (Node.js packages)

### Global install (needs sudo + proxy passthrough)

```bash
sudo HTTP_PROXY=http://127.0.0.1:2080 HTTPS_PROXY=http://127.0.0.1:2080 npm install -g <packages>
```

### Local install (in project)

```bash
export HTTP_PROXY=http://127.0.0.1:2080
export HTTPS_PROXY=http://127.0.0.1:2080
npm install <packages>
```

### Node.js version issues

Current Node.js on this machine is **v18**. Some packages (e.g. eslint v10+) require Node >= 20. Options:

1. **Pin older version**: `npm install -g eslint@8` (compatible with Node 18)
2. **Upgrade Node** via `n`:
   ```bash
   sudo HTTP_PROXY=http://127.0.0.1:2080 HTTPS_PROXY=http://127.0.0.1:2080 npm install -g n
   sudo n 20
   ```

---

## pip3 (Python packages)

System Python is PEP 668 managed — requires `--break-system-packages` for global installs.

```bash
pip3 install --break-system-packages --proxy http://127.0.0.1:2080 <packages>
```

### Examples

```bash
# Multiple packages
pip3 install --break-system-packages --proxy http://127.0.0.1:2080 openpyxl pandas numpy

# Specific version
pip3 install --break-system-packages --proxy http://127.0.0.1:2080 flask==3.0.0

# Upgrade
pip3 install --break-system-packages --proxy http://127.0.0.1:2080 --upgrade pip
```

### Uninstall

```bash
pip3 uninstall --break-system-packages <package>
```

---

## curl-based installers (bun, nvm, rustup, etc.)

Always pass proxy to curl:

```bash
# Option 1: inline proxy flag
curl -fsSL --proxy http://127.0.0.1:2080 <url> | bash

# Option 2: export env vars first (recommended — covers sub-downloads too)
export HTTP_PROXY=http://127.0.0.1:2080
export HTTPS_PROXY=http://127.0.0.1:2080
curl -fsSL <url> | bash
```

### Common installers

```bash
# Bun
curl -fsSL --proxy http://127.0.0.1:2080 https://bun.sh/install | bash

# nvm (Node Version Manager)
curl -fsSL --proxy http://127.0.0.1:2080 https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash

# Rustup
curl -fsSL --proxy http://127.0.0.1:2080 https://sh.rustup.rs | sh
```

After install, reload shell: `source ~/.bashrc`

---

## wget

```bash
wget -e use_proxy=yes -e http_proxy=http://127.0.0.1:2080 -e https_proxy=http://127.0.0.1:2080 <url>

# Or with env vars already exported:
wget <url>
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Network is unreachable` / `Failed to connect` / `Connection timed out` | Missing proxy | Set `HTTP_PROXY` / `HTTPS_PROXY` or use `--proxy` flag |
| `EACCES: permission denied` | npm global install without sudo | Add `sudo` with proxy env vars passed through |
| `EBADENGINE Unsupported engine` | Package requires newer Node.js | Pin older version or upgrade Node via `n` |
| `externally-managed-environment` | PEP 668 system Python | Add `--break-system-packages` to pip3 |
| `sudo: command not found` for proxy vars | sudo doesn't inherit env | Pass vars inline: `sudo HTTP_PROXY=... npm install -g ...` |

### Check what's installed

```bash
apt list --installed | grep <pkg>
npm list -g --depth=0
pip3 list | grep <pkg>
which <command>
```
