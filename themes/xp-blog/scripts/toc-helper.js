/**
 * TOC Helper for xp-blog theme
 * Generates an xp.css tree-view from h1-h3 headings.
 * Usage: <%- toc(page.content) %>
 */
hexo.extend.helper.register('toc', function(content) {
  if (!content) return '';

  var headingRegex = /<h([1-3])\s*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi;
  var headings = [];
  var match;
  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]*>/g, '')
    });
  }
  if (headings.length === 0) return '';

  var html = '<ul class="tree-view">\n';
  var prevLevel = headings[0].level;
  // stack tracks nested <ul> depths (not counting tree-view root)
  var nested = 0;

  headings.forEach(function(h, i) {
    if (i === 0) {
      html += '<li><a href="#' + h.id + '">' + h.text + '</a>';
      prevLevel = h.level;
      return;
    }

    if (h.level > prevLevel) {
      // Deeper: open nested <ul>
      html += '\n<ul>\n<li><a href="#' + h.id + '">' + h.text + '</a>';
      nested++;
    } else if (h.level < prevLevel) {
      // Shallower: close nested <ul>s
      while (nested > 0 && h.level <= prevLevel) {
        html += '</li>\n</ul>\n</li>\n';
        nested--;
        prevLevel--;
      }
      html += '<li><a href="#' + h.id + '">' + h.text + '</a>';
    } else {
      // Same level: sibling
      html += '</li>\n<li><a href="#' + h.id + '">' + h.text + '</a>';
    }
    prevLevel = h.level;
  });

  // Close any remaining nested <ul>s
  while (nested > 0) {
    html += '</li>\n</ul>\n</li>\n';
    nested--;
  }
  // Close the last <li> and the tree-view
  html += '</li>\n</ul>\n';

  return html;
});

/**
 * Word count helper
 */
hexo.extend.helper.register('word_count', function(content) {
  if (!content) return 0;
  var text = content.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
  return text.length;
});

/**
 * Reading time helper
 */
hexo.extend.helper.register('reading_time', function(content) {
  var count = hexo.extend.helper.get('word_count').call(this, content);
  return Math.max(1, Math.ceil(count / 300));
});
