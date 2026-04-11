import hljs from 'highlight.js/lib/core';
import rust from 'highlight.js/lib/languages/rust';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import katex from 'katex';
// @ts-ignore
import move from './hljs-move.js';

// Register languages
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('move', move);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);

/**
 * Highlight all <pre><code> blocks and render LaTeX math inside a container.
 */
export function highlightCodeBlocks(container: HTMLElement) {
  // 1. Syntax highlight code blocks
  const blocks = container.querySelectorAll('pre code');
  blocks.forEach((block) => {
    if (block.classList.contains('hljs')) return;
    const text = block.textContent || '';
    const isMove = /\b(module|struct|fun|public|entry|acquires|has|move_to|borrow_global|aggregator_v2)\b/.test(text);
    const isBash = /^\s*(aptos|curl|npm|node|cd|ls|grep)\b/m.test(text);
    if (isMove) block.classList.add('language-move');
    else if (isBash) block.classList.add('language-bash');
    else block.classList.add('language-rust');
    hljs.highlightElement(block as HTMLElement);
  });

  // 2. Render LaTeX math
  // Block math: $$...$$ or \[...\]
  renderLatex(container);
}

/**
 * Render LaTeX math expressions in the container.
 * Supports:
 *   - Block math: $$...$$ or <span class="math-block">...</span>
 *   - Inline math: $...$ or <span class="math-inline">...</span>
 *   - <math> tags with latex attribute
 */
function renderLatex(container: HTMLElement) {
  // Handle <span class="math-block"> and <span class="math-inline">
  container.querySelectorAll('.math-block, .math-inline').forEach((el) => {
    if (el.getAttribute('data-rendered')) return;
    const latex = el.textContent || '';
    const isBlock = el.classList.contains('math-block');
    try {
      el.innerHTML = katex.renderToString(latex, {
        displayMode: isBlock,
        throwOnError: false,
        trust: true,
      });
      el.setAttribute('data-rendered', 'true');
    } catch {}
  });

  // Handle raw $$...$$ in text nodes (block math)
  // And $...$ (inline math) — but be careful not to match currency like $10
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent && (node.textContent.includes('$$') || /\$[^$\d\s][^$]*\$/.test(node.textContent))) {
      // Don't process inside pre/code
      const parent = node.parentElement;
      if (parent && (parent.tagName === 'PRE' || parent.tagName === 'CODE' || parent.closest('pre'))) continue;
      textNodes.push(node);
    }
  }

  textNodes.forEach((textNode) => {
    const text = textNode.textContent || '';
    // Replace $$...$$ (block) first, then $...$ (inline)
    const replaced = text
      .replace(/\$\$([^$]+)\$\$/g, (_, latex) => {
        try {
          return katex.renderToString(latex.trim(), { displayMode: true, throwOnError: false });
        } catch { return _; }
      })
      .replace(/\$([^$\d\s][^$]*?)\$/g, (_, latex) => {
        try {
          return katex.renderToString(latex.trim(), { displayMode: false, throwOnError: false });
        } catch { return _; }
      });

    if (replaced !== text) {
      const span = document.createElement('span');
      span.innerHTML = replaced;
      textNode.parentNode?.replaceChild(span, textNode);
    }
  });
}
