# XvectR

**XvectR** is a powerful, multipurpose AI coding assistant built entirely as a VS Code extension. Designed with privacy and local execution in mind, XvectR leverages local Large Language Models (via Ollama) to help you write, understand, and debug code without ever sending your data to the cloud.

## ✨ Features

- **Local AI Chat Interface:** A built-in, VS Code native sidebar chat interface that interacts with your code securely on your machine.
- **Smart File Mentions:** Type `@` in the chat to instantly pull up a dropdown of your workspace files. Select a file to inject its exact context directly into your prompt.
- **Auto-Ollama Management:** Don't worry about forgetting to start your local AI server. XvectR automatically detects and starts Ollama in the background when you activate the extension!
- **Markdown & Code Highlighting:** Chat responses are beautifully formatted with Markdown and syntax highlighting. Easily copy generated code with a single click.
- **Workspace Retrieval-Augmented Generation (RAG):** (Experimental) Uses `LanceDB` and `Tree-Sitter` under the hood to index your workspace, allowing the AI to understand your entire project's context automatically.

---

## 🛠️ Prerequisites

Before you can run XvectR, ensure you have the following installed on your system:

1. [Node.js](https://nodejs.org/) (v18 or higher recommended)
2. [VS Code](https://code.visualstudio.com/) (v1.88.0 or higher)
3. [Ollama](https://ollama.com/): You must have Ollama installed globally on your machine to serve the local AI models.

---

## 🚀 Installation & Setup for Development

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd XvectR
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run the Extension:**
   - Open the `XvectR` folder in VS Code.
   - Press `F5` to open a new **Extension Development Host** window with XvectR loaded.
   - Or, open the "Run and Debug" view on the sidebar and click the "Run Extension" play button.

4. **Packaging the Extension (Optional):**
   If you want to install this extension permanently in your main VS Code environment:
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```
   Then install the generated `.vsix` file in VS Code.

---

## 💡 How to Use

1. Click on the **XvectR icon** in your VS Code Activity Bar (left sidebar) to open the chat panel.
2. The extension will automatically verify if Ollama is running on port `11434` and start it if it isn't.
3. Type your coding questions into the chat.
4. **Context Injection:** If you want the AI to read a specific file, simply type `@` followed by the filename (e.g., `@chatViewProvider.js`). This will append the file's contents into the AI's context so it can give you highly specific answers!

---

## 🏗️ Architecture Stack

- **Extension API:** Built with the standard VS Code Extension API (`extension.js`).
- **Webview UI:** Uses Vanilla HTML/CSS/JS (`panel.html`) with `marked.js` and `highlight.js` for rendering chat natively.
- **Local LLM Integration:** `ollama` npm package and custom background process management.
- **Indexing & Retrieval:** Integrates `@lancedb/lancedb` for local vector storage, and `tree-sitter` for advanced AST (Abstract Syntax Tree) parsing of JavaScript and Java files.