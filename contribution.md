# Contributing to Adaptive Network Traffic Generator (ATG)

Thank you for your interest in contributing! This guide outlines how to contribute effectively.

---

## Getting Started

1. Fork the repository  
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/Adaptive-Network-Traffic-Generator.git
   cd Adaptive-Network-Traffic-Generator
   ```
3. Add upstream:
   ```bash
   git remote add upstream https://github.com/ANair97/Adaptive-Network-Traffic-Generator.git
   ```

---

## Development Setup

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
# or
source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Branching

- `feat/<name>` → new feature  
- `fix/<name>` → bug fix  
- `docs/<name>` → documentation  
- `refactor/<name>` → code cleanup  

```bash
git checkout main
git pull upstream main
git checkout -b feat/your-feature
```

---

## Commits

Follow Conventional Commits:

```
feat(module): add feature
fix(module): resolve issue
docs(readme): update docs
```

---

## Pull Requests

Before submitting:

- Code follows project structure (level0, level1_backend, level2)  
- No debug or unused code  
- API updates reflected in README  

```bash
git fetch upstream
git rebase upstream/main
```

Submit PR to `main`.

---

## Reporting Bugs

Include:
- Description  
- Steps to reproduce  
- Expected vs actual behavior  
- Logs/screenshots  

---

## Feature Requests

- Describe the problem  
- Suggest a solution  
- Mention affected module (level0 / level1_backend / level2 / frontend)  

---

## Coding Standards

### Backend
- Follow PEP 8  
- Use type hints  
- Keep modules structured:
  - level0 → traffic generation  
  - level1_backend → API & orchestration  
  - level2 → receiver validation  

### Frontend
- Use functional components  
- Keep components modular  

### General
- No hardcoded secrets  
- Use `.env`  
- Maintain modular architecture  

---

## License

By contributing, you agree to the **Apache License 2.0** used in this project.

---

## Contact

ISFCR, PES University  
office.isfcr@pes.edu
