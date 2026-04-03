import base64
import json
import logging
import os

import boto3
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

secrets_client = boto3.client("secretsmanager", region_name="us-east-1")
kms_client = boto3.client("kms")

_resend_api_key = None


def _get_resend_api_key():
    global _resend_api_key
    if _resend_api_key is None:
        response = secrets_client.get_secret_value(SecretId="resend-api-key")
        _resend_api_key = response["SecretString"]
    return _resend_api_key


def _decrypt_code(encrypted_code, user_pool_id, trigger_source):
    decoded = base64.b64decode(encrypted_code)
    response = kms_client.decrypt(
        CiphertextBlob=decoded,
        EncryptionContext={
            "userPoolId": user_pool_id,
            "triggerSource": trigger_source,
        },
    )
    return response["Plaintext"].decode("utf-8")


def _send_email(api_key, to_email, subject, html_body):
    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": "ScatterPilot <noreply@scatterpilot.com>",
            "to": [to_email],
            "subject": subject,
            "html": html_body,
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def _verification_email(code):
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#0f172a;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">ScatterPilot</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">Verify your email address</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Thanks for signing up! Use the verification code below to confirm your email address and activate your account.
              </p>
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:1px;">Verification Code</p>
                <p style="margin:0;color:#0f172a;font-size:36px;font-weight:700;letter-spacing:8px;font-family:monospace;">{code}</p>
              </div>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                This code expires in 24 hours. If you didn't create a ScatterPilot account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                &copy; 2025 ScatterPilot. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _password_reset_email(code):
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#0f172a;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">ScatterPilot</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">Reset your password</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                We received a request to reset your password. Use the code below to complete the process.
              </p>
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:1px;">Reset Code</p>
                <p style="margin:0;color:#0f172a;font-size:36px;font-weight:700;letter-spacing:8px;font-family:monospace;">{code}</p>
              </div>
              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                This code expires in 1 hour. If you didn't request a password reset, please ignore this email &mdash; your password will not be changed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                &copy; 2025 ScatterPilot. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def handler(event, context):
    logger.info("Received Cognito custom email sender event: triggerSource=%s", event.get("triggerSource"))

    trigger_source = event.get("triggerSource", "")
    user_pool_id = event.get("userPoolId", "")
    request = event.get("request", {})
    encrypted_code = request.get("code")
    user_attributes = request.get("userAttributes", {})
    to_email = user_attributes.get("email")

    if not to_email:
        logger.error("No email address in userAttributes")
        return event

    if not encrypted_code:
        logger.error("No code in request")
        return event

    code = _decrypt_code(encrypted_code, user_pool_id, trigger_source)
    api_key = _get_resend_api_key()

    if trigger_source in ("CustomEmailSender_SignUp", "CustomEmailSender_ResendCode"):
        subject = "Verify your ScatterPilot account"
        html_body = _verification_email(code)
    elif trigger_source == "CustomEmailSender_ForgotPassword":
        subject = "Reset your ScatterPilot password"
        html_body = _password_reset_email(code)
    else:
        logger.warning("Unhandled triggerSource: %s — skipping email", trigger_source)
        return event

    result = _send_email(api_key, to_email, subject, html_body)
    logger.info("Email sent via Resend: id=%s", result.get("id"))

    return event
