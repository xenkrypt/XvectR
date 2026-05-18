import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: true
});

md.options.highlight = (code, lang) => {

    if (lang && hljs.getLanguage(lang)) {

        try {

            const highlighted = hljs.highlight(code, {
                language: lang
            }).value;

            return `
<pre class="hljs">
<code class="language-${lang}">
${highlighted}
</code>
</pre>
            `;

        } catch (err) {
            console.error(err);
        }
    }

    return `
<pre class="hljs">
<code>
${md.utils.escapeHtml(code)}
</code>
</pre>
    `;
};

export default md;