"""
Cognito CustomMessage trigger — customizes verification and password reset emails.

Sets emailSubject and emailMessage with branded HTML. Cognito substitutes the
real code for the {####} placeholder (codeParameter) before delivery via
COGNITO_DEFAULT. No KMS decryption needed — Cognito passes the placeholder,
not the encrypted code.
"""

import logging
import sys
from typing import Any, Dict

sys.path.insert(0, '/opt/python')

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

HANDLED_TRIGGERS = {
    'CustomMessage_SignUp',
    'CustomMessage_ResendCode',
    'CustomMessage_ForgotPassword',
}


# =============================================================================
# Email HTML builders
# =============================================================================

def _verification_html(code_placeholder: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FAFBF9;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFBF9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;border:1px solid #E2E5DE;overflow:hidden;">
          <tr>
            <td style="background:#4A6741;padding:28px 40px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ScatterPilot
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 12px;color:#1A2318;font-size:20px;font-weight:600;">
                Verify your email address
              </h2>
              <p style="margin:0 0 24px;color:#5F6B5A;font-size:15px;line-height:1.6;">
                Thanks for signing up for ScatterPilot. Use the code below to
                confirm your email address and activate your account.
              </p>
              <div style="background:#F4F7F3;border:1px solid #D4DDD0;border-radius:8px;
                          padding:24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#5F6B5A;font-size:12px;font-weight:600;
                           text-transform:uppercase;letter-spacing:0.08em;">
                  Verification Code
                </p>
                <p style="margin:0;color:#1A2318;font-size:36px;font-weight:700;
                           letter-spacing:10px;font-family:'Courier New',Courier,monospace;">
                  {code_placeholder}
                </p>
              </div>
              <p style="margin:0;color:#8A9484;font-size:13px;line-height:1.6;">
                This code expires in 24 hours. If you didn't create a ScatterPilot
                account you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #E2E5DE;">
              <p style="margin:0;color:#8A9484;font-size:12px;">
                &copy; 2026 ScatterPilot &middot; scatterpilot.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _password_reset_html(code_placeholder: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FAFBF9;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFBF9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;border:1px solid #E2E5DE;overflow:hidden;">
          <tr>
            <td style="background:#4A6741;padding:28px 40px;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ScatterPilot
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <h2 style="margin:0 0 12px;color:#1A2318;font-size:20px;font-weight:600;">
                Reset your password
              </h2>
              <p style="margin:0 0 24px;color:#5F6B5A;font-size:15px;line-height:1.6;">
                We received a request to reset your ScatterPilot password.
                Use the code below to complete the process.
              </p>
              <div style="background:#F4F7F3;border:1px solid #D4DDD0;border-radius:8px;
                          padding:24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#5F6B5A;font-size:12px;font-weight:600;
                           text-transform:uppercase;letter-spacing:0.08em;">
                  Reset Code
                </p>
                <p style="margin:0;color:#1A2318;font-size:36px;font-weight:700;
                           letter-spacing:10px;font-family:'Courier New',Courier,monospace;">
                  {code_placeholder}
                </p>
              </div>
              <p style="margin:0;color:#8A9484;font-size:13px;line-height:1.6;">
                This code expires in 1 hour. If you didn't request a password
                reset you can safely ignore this email &mdash; your password
                will not be changed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #E2E5DE;">
              <p style="margin:0;color:#8A9484;font-size:12px;">
                &copy; 2026 ScatterPilot &middot; scatterpilot.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# =============================================================================
# Handler
# =============================================================================

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    trigger_source: str = event.get('triggerSource', '')
    logger.info("CustomMessage trigger: %s", trigger_source)

    if trigger_source not in HANDLED_TRIGGERS:
        logger.info("Unhandled trigger %s — returning event unchanged", trigger_source)
        return event

    request        = event.get('request', {})
    code_parameter = request.get('codeParameter', '{####}')

    if trigger_source in ('CustomMessage_SignUp', 'CustomMessage_ResendCode'):
        subject = 'Verify your ScatterPilot account'
        html    = _verification_html(code_parameter)
    else:  # CustomMessage_ForgotPassword
        subject = 'Reset your ScatterPilot password'
        html    = _password_reset_html(code_parameter)

    event.setdefault('response', {})
    event['response']['emailSubject'] = subject
    event['response']['emailMessage'] = html

    return event
