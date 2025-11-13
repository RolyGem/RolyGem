import React, { useState, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { CopyIcon } from './icons/CopyIcon';
import { CheckIcon } from './icons/CheckIcon';
import { copyToClipboard } from '../utils/clipboard';

const CodeBlock: React.FC<{ language: string; code: string }> = memo(({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  return (
    <div className="bg-gray-900 dark:bg-black rounded-lg my-4 relative code-block overflow-hidden">
      <div className="flex justify-between items-center px-4 py-2 text-xs text-gray-400 bg-gray-800 dark:bg-gray-900/50 rounded-t-lg">
        <span>{language || 'code'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors">
          {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto text-white hljs">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
});

export const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    // Fix: Removed `prose-sm` to allow global font-size and line-height variables to apply correctly.
    <div className="prose dark:prose-invert max-w-none break-words">
      <ReactMarkdown
        children={content}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeContent = String(children).replace(/\n$/, '');
            return match ? (
              <CodeBlock language={match[1]} code={codeContent} />
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      />
    </div>
  );
};