# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## OpenClaw Gateway

The openclaw gateway runs as a systemd service on this machine. Do NOT use `openclaw gateway restart`.

To restart the gateway:

```bash
sudo systemctl restart openclaw-gateway
```

To check gateway status:

```bash
sudo systemctl status openclaw-gateway
```

---

Add whatever helps you do your job. This is your cheat sheet.
