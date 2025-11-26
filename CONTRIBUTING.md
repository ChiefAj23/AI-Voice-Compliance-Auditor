# Contributing to AI Voice Compliance Auditor

Thank you for your interest in contributing to AI Voice Compliance Auditor! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/voice_audit.git
   cd voice_audit
   ```

3. **Set up development environment**:
   ```bash
   # Backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt

   # Frontend
   cd frontend
   npm install
   ```

4. **Create a branch** for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📝 Development Guidelines

### Code Style

- **Python**: Follow PEP 8 style guide
- **TypeScript/React**: Follow ESLint rules configured in the project
- **Comments**: Write clear, concise comments for complex logic
- **Documentation**: Update relevant documentation when adding features

### Commit Messages

Use clear, descriptive commit messages:
```
feat: Add user authentication system
fix: Resolve bcrypt version compatibility issue
docs: Update README with installation instructions
refactor: Clean up database migration logic
```

### Testing

- Test your changes thoroughly before submitting
- Ensure backend API endpoints work correctly
- Test frontend components in different browsers
- Verify database migrations work as expected

## 🔧 Making Changes

### Backend Changes

1. Make your changes in the relevant files
2. Test the API endpoints using the FastAPI docs at `http://127.0.0.1:8000/docs`
3. Ensure database migrations are backward compatible

### Frontend Changes

1. Make your changes in React components
2. Test UI responsiveness and dark mode compatibility
3. Ensure API integration works correctly

## 📤 Submitting Changes

1. **Push your changes** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub:
   - Provide a clear description of your changes
   - Reference any related issues
   - Include screenshots for UI changes

3. **Wait for review** - Maintainers will review your PR and provide feedback

## 🐛 Reporting Bugs

If you find a bug, please open an issue with:
- Clear description of the bug
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Python version, etc.)
- Relevant logs or error messages

## 💡 Feature Requests

We welcome feature requests! Please open an issue with:
- Clear description of the feature
- Use case and benefits
- Possible implementation approach (if you have ideas)

## 📋 Project Structure

```
voice_audit/
├── api/                 # Backend API (FastAPI)
├── frontend/            # React frontend
├── Data/                # Database and sample files
├── dashboard/           # Legacy Streamlit dashboard
├── requirements.txt     # Python dependencies
└── README.md           # Main documentation
```

## 🔐 Security

- **Never commit** secrets, API keys, or passwords
- Use environment variables for sensitive configuration
- Review security implications of your changes
- Report security vulnerabilities privately

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort!

