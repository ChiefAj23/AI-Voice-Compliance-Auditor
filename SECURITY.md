# Security Policy

## Supported Versions

We actively support the latest version of the project. Older versions may receive security updates on a case-by-case basis.

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please report it privately:

1. **Email**: Contact the maintainer directly (see GitHub profile)
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

We will respond to security reports within 48 hours and work on a fix as quickly as possible.

## Security Best Practices

### For Users

1. **Set the first admin password**: Set `ADMIN_PASSWORD` before the first start, or use the generated one printed in the API's console output, then change it
2. **Use Environment Variables**: Never commit secrets, API keys, or passwords to version control
3. **Keep Dependencies Updated**: Regularly update dependencies to get security patches
4. **Use HTTPS**: Always use HTTPS in production
5. **Limit Access**: Restrict database and API access to authorized users only
6. **Regular Backups**: Maintain regular backups of your database

### For Developers

1. **No Hardcoded Secrets**: Always use environment variables or secure configuration
2. **Input Validation**: Validate and sanitize all user inputs
3. **SQL Injection Prevention**: Use parameterized queries (SQLAlchemy ORM handles this)
4. **XSS Prevention**: Sanitize output and use React's built-in XSS protection
5. **Authentication**: Always verify user authentication and authorization
6. **Dependencies**: Regularly audit dependencies for known vulnerabilities

## Known Security Considerations

- **Admin password**: There is no default. It comes from `ADMIN_PASSWORD` or is generated on first start
- **JWT secret key**: There is no default. Without `JWT_SECRET_KEY`, a random key is used for each run
- **Access control**: Every data route needs a signed-in user with the matching permission. New sign-ups have no role until an admin assigns one
- **Custom rules**: Expressions are checked by `api/safe_eval.py` (comparisons, and/or/not, arithmetic, a few functions and text methods), never passed to `eval()`
- **Database**: SQLite is used for development; consider PostgreSQL for production
- **Email Passwords**: Use App Passwords for Gmail SMTP authentication
- **File Uploads**: Validate file types and sizes for audio uploads

## Security Updates

Security updates will be released as soon as possible after a vulnerability is discovered and fixed. Check the [Releases](https://github.com/yourusername/voice_audit/releases) page for updates.

## Acknowledgments

We thank all security researchers who responsibly disclose vulnerabilities to help improve the security of this project.

