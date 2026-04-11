import hljs from 'highlight.js/lib/core';
import rust from 'highlight.js/lib/languages/rust';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
// @ts-ignore
import move from './hljs-move.js';

// Register languages
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('move', move);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);

/**
 * Highlight all <pre><code> blocks inside a container element.
 * Detects Move code by looking for Move keywords.
 */
export function highlightCodeBlocks(container: HTMLElement) {
  const blocks = container.querySelectorAll('pre code');
  blocks.forEach((block) => {
    const text = block.textContent || '';
    // Auto-detect language
    if (!block.classList.contains('hljs')) {
      // Check for Move keywords
      const isMove = /\b(module|struct|fun|public|entry|acquires|has|move_to|borrow_global|aggregator_v2)\b/.test(text);
      const isBash = /^\s*(aptos|curl|npm|node|cd|ls|grep)\b/m.test(text);

      if (isMove) {
        block.classList.add('language-move');
      } else if (isBash) {
        block.classList.add('language-bash');
      } else {
        block.classList.add('language-rust');
      }

      hljs.highlightElement(block as HTMLElement);
    }
  });
}
