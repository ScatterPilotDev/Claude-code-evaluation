# Deployment Script Flags

This document describes the optional flags available for the ScatterPilot deployment script.

## Available Flags

### `--skip-security-check`

**Purpose:** Skip security credential scanning during deployment with a warning.

**When to Use:**
- ✅ GitHub Codespaces development environment
- ✅ Local development machines
- ✅ Evaluation and testing purposes
- ✅ Environments where credential scanning produces false positives

**When NOT to Use:**
- ❌ Production deployments
- ❌ Shared or public infrastructure
- ❌ Any environment handling real customer data

**Usage:**
```bash
cd scatterpilot
./scripts/00-deploy-all.sh --skip-security-check
```

**What It Does:**
- Displays a prominent warning banner
- Skips the security-check.sh script execution
- Requires acknowledgment before proceeding (unless --force is also used)
- All other security best practices remain in place

**Example Output:**
```
╔═══════════════════════════════════════════════════════════════╗
║                      ⚠ WARNING ⚠                             ║
╚═══════════════════════════════════════════════════════════════╝

Security checks will be SKIPPED during this deployment.

This flag is intended for:
  • Development environments (GitHub Codespaces, local dev)
  • Evaluation and testing purposes
  • Environments where credential scanning causes false positives

DO NOT use this flag for production deployments!
```

---

### `--force`

**Purpose:** Skip ALL interactive prompts for fully automated deployments.

**When to Use:**
- ✅ CI/CD pipelines
- ✅ Automated deployment scripts
- ✅ Non-interactive environments
- ✅ Scheduled deployments

**When NOT to Use:**
- ❌ First-time deployments (requires user decisions)
- ❌ When you haven't reviewed deployment configuration
- ❌ When Bedrock access isn't confirmed
- ❌ Learning or exploratory deployments

**Usage:**
```bash
cd scatterpilot
./scripts/00-deploy-all.sh --force
```

**What It Does:**
- Displays a warning banner
- Skips ALL "Press Enter to continue" prompts
- Skips ALL "Continue? (y/n)" prompts
- Runs security checks but continues despite failures
- Assumes Bedrock access is configured
- Proceeds through all deployment stages automatically

**Important Notes:**
- Still runs security checks (shows warnings if issues found)
- Does NOT skip prerequisites checking
- Deployment configuration must already exist or will prompt for it
- Review all settings before using this flag

**Example Output:**
```
╔═══════════════════════════════════════════════════════════════╗
║                      ⚠ WARNING ⚠                             ║
╚═══════════════════════════════════════════════════════════════╝

Force mode enabled - all prompts will be skipped.

This flag is intended for:
  • Automated CI/CD pipelines
  • Scripted deployments
  • Non-interactive environments

Ensure you have reviewed all settings before using --force!

[FORCE MODE] Proceeding automatically...
```

---

## Combining Flags

You can use both flags together for fully automated development deployments:

```bash
./scripts/00-deploy-all.sh --skip-security-check --force
```

**This combination:**
- Skips security credential scanning
- Skips all interactive prompts
- Best for automated dev/test pipelines in Codespaces or similar environments

---

## Help

Display all available options:

```bash
./scripts/00-deploy-all.sh --help
```

Output:
```
Usage: ./scripts/00-deploy-all.sh [OPTIONS]

Options:
  --skip-security-check    Skip security check with warning (for dev/eval)
  --force                  Skip all interactive prompts (use with caution)
  --help, -h               Show this help message

Examples:
  ./scripts/00-deploy-all.sh                              # Normal deployment
  ./scripts/00-deploy-all.sh --skip-security-check        # Skip security check (Codespaces/dev)
  ./scripts/00-deploy-all.sh --force                      # Fully automated deployment
```

---

## Common Use Cases

### GitHub Codespaces Development

The security check script may flag credentials in the Codespaces environment. Use:

```bash
./scripts/00-deploy-all.sh --skip-security-check
```

### CI/CD Pipeline

For fully automated deployments in a CI/CD pipeline:

```bash
# Export AWS credentials as environment variables first
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-1"

# Run fully automated deployment
cd scatterpilot
./scripts/00-deploy-all.sh --force
```

### Local Development with Manual Control

For interactive local development with full control:

```bash
# No flags - normal interactive mode
./scripts/00-deploy-all.sh
```

---

## Security Considerations

### Production Deployments

**NEVER use these flags for production deployments:**
- Always run security checks
- Always review prompts and confirmations
- Always verify configuration before deploying
- Always use least-privilege IAM credentials

### Development Deployments

Even in development:
- Use dedicated AWS accounts for dev/test
- Use scoped IAM policies (see `scripts/scatterpilot-deploy-policy-optimized.json`)
- Never commit credentials to version control
- Rotate credentials regularly
- Enable CloudTrail logging

---

## Troubleshooting

### "Deployment cancelled for security reasons"

If you see this message and believe it's a false positive:

1. **Review the security issues** reported by the script
2. **Verify they are false positives** (e.g., Codespaces environment variables)
3. **Use the --skip-security-check flag** if appropriate:
   ```bash
   ./scripts/00-deploy-all.sh --skip-security-check
   ```

### "Prerequisites still not satisfied"

The --force flag does NOT skip prerequisites. If prerequisites fail:

1. Install missing packages (AWS CLI, SAM CLI, Python, etc.)
2. Configure AWS credentials
3. Run the script again

---

## Related Documentation

- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [QUICKSTART.md](../QUICKSTART.md) - Quick start guide
- [SECURITY.md](../SECURITY.md) - Security best practices
- [scripts/README.md](README.md) - All deployment scripts documentation

---

**Last Updated:** 2025-10-31
