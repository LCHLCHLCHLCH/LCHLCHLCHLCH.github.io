// ═══════════════════════════════════════════
// 图标选中
// ═══════════════════════════════════════════
(function() {
  var icons = document.querySelectorAll('.desktop-icon');
  function deselectAll() { icons.forEach(function(icon) { icon.classList.remove('selected'); }); }
  icons.forEach(function(icon) {
    icon.addEventListener('click', function(e) {
      e.stopPropagation();
      deselectAll();
      icon.classList.add('selected');
    });
  });
  document.body.addEventListener('click', function(e) {
    if (e.target.closest('.window') || e.target.closest('.taskbar')) return;
    deselectAll();
  });
})();

// ═══════════════════════════════════════════
// 窗口管理器
// ═══════════════════════════════════════════
var wm = (function() {
  var container = document.getElementById('windowContainer');
  var taskbarItems = document.getElementById('taskbarItems');
  var windows = {};   // id → { el, taskBtn }
  var zCounter = 100;

  function bringToFront(el) {
    el.style.zIndex = ++zCounter;
  }

  var EDGE = 6; // 边缘检测像素

  function detectEdge(el, e) {
    var r = el.getBoundingClientRect();
    var x = e.clientX - r.left;
    var y = e.clientY - r.top;
    var top = y < EDGE, bottom = y > r.height - EDGE;
    var left = x < EDGE, right = x > r.width - EDGE;
    if (top && left) return 'nw';
    if (top && right) return 'ne';
    if (bottom && left) return 'sw';
    if (bottom && right) return 'se';
    if (top) return 'n';
    if (bottom) return 's';
    if (left) return 'w';
    if (right) return 'e';
    return null;
  }

  var CURSOR_MAP = { nw:'nw-resize', ne:'ne-resize', sw:'sw-resize', se:'se-resize',
                     n:'n-resize', s:'s-resize', w:'w-resize', e:'e-resize' };

  function makeInteractive(el, titleBar, resizable) {
    if (resizable === undefined) resizable = true;
    var drag = false, resize = false, dir = '', ox = 0, oy = 0;
    var startW, startH, startL, startT;
    var pendingMaxDrag = false, maxDownX = 0, maxDownY = 0;

    // 光标随边缘变化（不可缩放窗口不显示边缘光标）
    el.addEventListener('mousemove', function(e) {
      if (!resizable || drag || resize || el.classList.contains('maximized')) return;
      var d = detectEdge(el, e);
      el.style.cursor = d ? CURSOR_MAP[d] : '';
    });

    // 标题栏按下 → 拖动 或 顶边角缩放
    titleBar.addEventListener('mousedown', function(e) {
      if (e.target.closest('button')) return;
      // 最大化时：记录按下位置，待实际移动后再还原
      if (el.classList.contains('maximized')) {
        pendingMaxDrag = true;
        maxDownX = e.clientX;
        maxDownY = e.clientY;
        return;
      }
      bringToFront(el);
      var d = resizable ? detectEdge(el, e) : null;
      if (d && (d.indexOf('n') !== -1 || d.indexOf('w') !== -1 || d.indexOf('e') !== -1)) {
        if (d === 'w' || d === 'e') { drag = true; dir = ''; }
        else { resize = true; dir = d; }
      } else {
        drag = true;
      }
      if (drag) {
        var r = el.getBoundingClientRect();
        ox = e.clientX - r.left;
        oy = e.clientY - r.top;
      }
      if (resize) {
        var r2 = el.getBoundingClientRect();
        startW = r2.width; startH = r2.height;
        startL = r2.left; startT = r2.top;
        ox = e.clientX; oy = e.clientY;
      }
    });

    // 窗口 body 按下 → 可能缩放（底部/右侧/角）
    el.addEventListener('mousedown', function(e) {
      if (!resizable || el.classList.contains('maximized')) return;
      if (e.target.closest('.title-bar')) return;
      bringToFront(el);
      var d = detectEdge(el, e);
      if (d) {
        resize = true; dir = d;
        var r = el.getBoundingClientRect();
        startW = r.width; startH = r.height;
        startL = r.left; startT = r.top;
        ox = e.clientX; oy = e.clientY;
        e.preventDefault();
      }
    });

    document.addEventListener('mousemove', function(e) {
      // 最大化窗口：鼠标移动超过阈值才还原并开始拖动
      if (pendingMaxDrag) {
        if (Math.abs(e.clientX - maxDownX) > 3 || Math.abs(e.clientY - maxDownY) > 3) {
          pendingMaxDrag = false;
          var winData = windows[el._winId];
          if (winData && winData.toggleMaximize) {
            winData.toggleMaximize();
            var r2 = el.getBoundingClientRect();
            var ratio = maxDownX / window.innerWidth;
            var newLeft = maxDownX - r2.width * ratio;
            el.style.left = Math.max(0, Math.min(newLeft, window.innerWidth - r2.width)) + 'px';
            el.style.top = '0px';
            var r3 = el.getBoundingClientRect();
            ox = maxDownX - r3.left;
            oy = maxDownY - r3.top;
            drag = true;
          }
        }
        return;
      }
      if (drag) {
        el.style.left = (e.clientX - ox) + 'px';
        el.style.top  = (e.clientY - oy) + 'px';
      }
      if (resize) {
        var dx = e.clientX - ox;
        var dy = e.clientY - oy;
        var minW = 280, minH = 160;

        if (dir.indexOf('e') !== -1) {
          el.style.width = Math.max(minW, startW + dx) + 'px';
        }
        if (dir.indexOf('s') !== -1) {
          el.style.height = Math.max(minH, startH + dy) + 'px';
        }
        if (dir.indexOf('w') !== -1) {
          var nw = Math.max(minW, startW - dx);
          el.style.width = nw + 'px';
          el.style.left = (startL + (startW - nw)) + 'px';
        }
        if (dir.indexOf('n') !== -1) {
          var nh = Math.max(minH, startH - dy);
          el.style.height = nh + 'px';
          el.style.top = (startT + (startH - nh)) + 'px';
        }
      }
    });

    document.addEventListener('mouseup', function() {
      pendingMaxDrag = false;
      if (drag) { drag = false; }
      if (resize) { resize = false; dir = ''; }
    });

    el.addEventListener('mouseleave', function() {
      pendingMaxDrag = false;
      if (!drag && !resize) el.style.cursor = '';
    });
  }

  function createTaskBtn(id, title, iconUrl) {
    if (!taskbarItems) return null;
    var btn = document.createElement('div');
    btn.className = 'task-item';
    btn.innerHTML = '<img src="' + iconUrl + '" alt="" draggable="false">' + title;
    btn.onclick = function() {
      var w = windows[id];
      if (!w) return;
      if (w.el.style.display === 'block') {
        w.el.style.display = 'none';
      } else {
        w.el.style.display = 'block';
        bringToFront(w.el);
      }
    };
    taskbarItems.appendChild(btn);
    return btn;
  }

  function create(id, title, iconUrl, width, height, top, left, options) {
    options = options || {};
    if (windows[id]) {
      var ex = windows[id];
      ex.el.style.display = 'block';
      bringToFront(ex.el);
      return ex.el;
    }

    var el = document.createElement('div');
    el.className = 'window desktop-window';
    el._winId = id;
    el.style.width = width + 'px';
    el.style.height = height + 'px';
    el.style.top = top + 'px';
    el.style.left = left + 'px';

    var maxBtnHtml = options.resizable === false ? '' : '<button aria-label="Maximize"></button>';
    el.innerHTML =
      '<div class="title-bar win-titlebar">' +
        '<div class="title-bar-text">' +
          '<img src="' + iconUrl + '" alt="" draggable="false">' +
          title +
        '</div>' +
        '<div class="title-bar-controls">' +
          '<button aria-label="Minimize"></button>' +
          maxBtnHtml +
          '<button aria-label="Close" class="win-close"></button>' +
        '</div>' +
      '</div>' +
      '<div class="window-body win-body"></div>';

    el.style.display = 'none';
    container.appendChild(el);

    var titleBar = el.querySelector('.win-titlebar');
    var bodyEl = el.querySelector('.win-body');
    var closeBtn = el.querySelector('.win-close');
    var taskBtn = createTaskBtn(id, title, iconUrl);

    makeInteractive(el, titleBar, options.resizable !== false);

    // ── 最大化 / 还原 ──
    var maxBtn = el.querySelector('button[aria-label="Maximize"]');
    var restored = { left: left, top: top, width: width, height: height };

    function maximize() {
      restored = {
        left: parseInt(el.style.left) || left,
        top: parseInt(el.style.top) || top,
        width: parseInt(el.style.width) || width,
        height: parseInt(el.style.height) || height
      };
      el.classList.add('maximized');
      el.style.left = '0px';
      el.style.top = '0px';
      el.style.width = '100vw';
      el.style.height = '100vh';
    }

    function restore() {
      el.classList.remove('maximized');
      el.style.left = restored.left + 'px';
      el.style.top = restored.top + 'px';
      el.style.width = restored.width + 'px';
      el.style.height = restored.height + 'px';
    }

    function toggleMaximize() {
      if (el.classList.contains('maximized')) {
        restore();
      } else {
        maximize();
      }
      bringToFront(el);
    }

    titleBar.addEventListener('dblclick', function(e) {
      if (e.target.closest('button')) return;
      toggleMaximize();
    });

    if (maxBtn) {
      maxBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleMaximize();
      });
    }

    closeBtn.addEventListener('click', function() {
      el.style.display = 'none';
    });

    el.addEventListener('mousedown', function() {
      bringToFront(el);
    });

    windows[id] = { el: el, body: bodyEl, taskBtn: taskBtn, titleBar: titleBar, toggleMaximize: toggleMaximize };

    el.style.display = 'block';
    bringToFront(el);

    return el;
  }

  function getBodyEl(id) {
    return windows[id] ? windows[id].body : null;
  }

  function setBodyHTML(id, html) {
    var b = getBodyEl(id);
    if (b) b.innerHTML = html;
  }

  return { create: create, getBody: getBodyEl, setBody: setBodyHTML, bringToFront: bringToFront };
})();

// ═══════════════════════════════════════════
// 资源管理器（博客文章文件夹）
// ═══════════════════════════════════════════
(function() {
  var EXPLORER_ID = 'explorer';
  var posts = [];

  function getFileIcon(post) {
    return post.type === 'html' ? 'icons/html.png' : 'icons/fax-cover-page.png';
  }

  function renderIcons(iconsContainer, previewPane, statusField) {
    iconsContainer.innerHTML = '';
    posts.forEach(function(post) {
      var item = document.createElement('div');
      item.className = 'explorer-icon-item';
      item.setAttribute('data-slug', post.slug);
      item.innerHTML =
        '<div class="explorer-icon-img">' +
          '<img src="' + getFileIcon(post) + '" alt="" draggable="false">' +
          '<div class="icon-overlay"></div>' +
        '</div>' +
        '<div class="explorer-icon-label">' + post.title + '</div>';

      item.addEventListener('click', function(e) {
        e.stopPropagation();
        iconsContainer.querySelectorAll('.explorer-icon-item.selected').forEach(function(el) {
          el.classList.remove('selected');
        });
        item.classList.add('selected');
        showPreview(post, previewPane);
      });

      item.addEventListener('dblclick', function() {
        if (post.type === 'markdown') {
          openMarkdownWindow(post);
        } else {
          openHtmlWindow(post);
        }
      });

      iconsContainer.appendChild(item);
    });
    statusField.textContent = posts.length + ' 个文件';
  }

  function showPreview(post, previewPane) {
    var typeLabel = post.type === 'markdown' ? 'Markdown 文档' : 'HTML 页面';
    previewPane.innerHTML =
      '<div class="preview-title">' + post.title + '</div>' +
      '<div class="preview-label">类型</div>' +
      '<div class="preview-value">' + typeLabel + '</div>' +
      '<div class="preview-label">日期</div>' +
      '<div class="preview-value">' + post.date + '</div>' +
      '<div class="preview-label">摘要</div>' +
      '<div class="preview-value">' + post.summary + '</div>';
  }

  function openMarkdownWindow(post) {
    var winId = 'post-' + post.slug;
    wm.create(winId, post.title + ' - 记事本', 'icons/fax-cover-page.png', 580, 380, 60 + Math.random() * 80, 180 + Math.random() * 60);
    var body = wm.getBody(winId);
    body.innerHTML = '<div class="content-body"><p style="color:#808080">加载中…</p></div>';

    fetch('posts/' + post.slug + '.md')
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function(md) {
        wm.setBody(winId, '<div class="content-body">' + marked.parse(md) + '</div>');
      })
      .catch(function(err) {
        wm.setBody(winId, '<div class="content-body"><p style="color:red">加载失败: ' + err.message + '</p></div>');
      });
  }

  function openHtmlWindow(post) {
    var winId = 'post-' + post.slug;
    wm.create(winId, post.title + ' - Internet Explorer', 'icons/html.png', 640, 400, 60 + Math.random() * 80, 160 + Math.random() * 60);
    wm.setBody(winId, '<div class="iframe-body"><iframe src="posts/' + post.slug + '.html"></iframe></div>');
  }

  window.openExplorer = function() {
    var el = wm.create(EXPLORER_ID, '博客文章', 'icons/explorer.png', 700, 440, 60, 160);
    var body = wm.getBody(EXPLORER_ID);

    body.innerHTML =
      '<div class="explorer-layout">' +
        '<div class="explorer-icons" id="explorerIcons"></div>' +
        '<div class="explorer-preview" id="explorerPreview"><p class="preview-empty">← 点击文件查看信息</p></div>' +
      '</div>' +
      '<div class="status-bar"><div class="status-bar-field" id="explorerStatus">0 个文件</div></div>';

    fetch('posts/index.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        posts = data;
        renderIcons(
          body.querySelector('#explorerIcons'),
          body.querySelector('#explorerPreview'),
          body.querySelector('#explorerStatus')
        );
      })
      .catch(function() {
        body.querySelector('#explorerPreview').innerHTML = '<p class="preview-empty" style="color:red">加载失败</p>';
      });
  };
})();

// ═══════════════════════════════════════════
// 桌面图标双击
// ═══════════════════════════════════════════
(function() {
  var blogIcon = document.querySelector('.desktop-icon[data-icon="blog"]');
  if (blogIcon) {
    blogIcon.addEventListener('dblclick', function() {
      openExplorer();
    });
  }

  var cpIcon = document.querySelector('.desktop-icon[data-icon="control-panel"]');
  if (cpIcon) {
    cpIcon.addEventListener('dblclick', function() {
      openControlPanel();
    });
  }

  var ghIcon = document.querySelector('.desktop-icon[data-icon="github"]');
  if (ghIcon) {
    ghIcon.addEventListener('dblclick', function() {
      window.open('https://github.com/LCHLCHLCHLCH', '_blank');
    });
  }

  var ieIcon = document.querySelector('.desktop-icon[data-icon="ie"]');
  if (ieIcon) {
    ieIcon.addEventListener('dblclick', function() {
      openBrowser();
    });
  }
})();

// ═══════════════════════════════════════════
// 控制面板
// ═══════════════════════════════════════════
function openControlPanel() {
  var winId = 'control-panel';
  wm.create(winId, '控制面板', 'icons/control-panel.png', 420, 320, 120, 220, { resizable: false });
  var body = wm.getBody(winId);

  var currentSize = getComputedStyle(document.body).getPropertyValue('--content-font-size').trim();
  var sliderVal = Math.round((parseInt(currentSize) - 10) / 2); // 10→0, 12→1, ... 20→5

  var currentSelect = getComputedStyle(document.body).getPropertyValue('--content-select').trim();
  var checkedAttr = currentSelect === 'text' ? ' checked' : '';

  body.innerHTML =
    '<div class="control-panel-body">' +
      '<h3>显示设置</h3>' +
      '<div class="control-panel-item">' +
        '<span class="cp-label">文章字体大小</span>' +
        '<div class="cp-control">' +
          '<input type="range" id="fontSizeSlider" min="0" max="5" value="' + sliderVal + '" step="1">' +
          '<span class="cp-slider-val" id="sliderLabel">' + currentSize + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="control-panel-item">' +
        '<span class="cp-label">文字可选</span>' +
        '<div class="cp-control">' +
          '<input type="checkbox" id="selectCheckbox"' + checkedAttr + '>' +
          '<label for="selectCheckbox">允许选中</label>' +
        '</div>' +
      '</div>' +
    '</div>';

  var slider = body.querySelector('#fontSizeSlider');
  var sliderLabel = body.querySelector('#sliderLabel');
  if (slider) {
    slider.addEventListener('input', function() {
      var size = (10 + parseInt(slider.value) * 2) + 'px';
      sliderLabel.textContent = size;
      document.body.style.setProperty('--content-font-size', size);
      try { localStorage.setItem('xp-blog-font-size', size); } catch(e) {}
    });
  }

  var checkbox = body.querySelector('#selectCheckbox');
  if (checkbox) {
    checkbox.addEventListener('change', function() {
      var val = checkbox.checked ? 'text' : 'none';
      document.body.style.setProperty('--content-select', val);
      try { localStorage.setItem('xp-blog-content-select', val); } catch(e) {}
    });
  }
}

// ═══════════════════════════════════════════
// IE 浏览器
// ═══════════════════════════════════════════
function openBrowser(url) {
  url = url || 'https://www.baidu.com';
  var winId = 'browser';
  wm.create(winId, 'Internet Explorer', 'icons/ie.png', 800, 520, 40, 100);
  var body = wm.getBody(winId);

  body.innerHTML =
    '<div class="browser-toolbar">' +
      '<span class="address-label">地址</span>' +
      '<input type="text" class="address-input" id="browserUrl" value="' + url + '">' +
    '</div>' +
    '<div class="browser-iframe-wrap">' +
      '<iframe src="' + url + '" id="browserFrame"></iframe>' +
    '</div>';

  var input = body.querySelector('#browserUrl');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        var val = input.value.trim();
        if (!val) return;
        if (!/^https?:\/\//i.test(val)) val = 'https://' + val;
        var frame = body.querySelector('#browserFrame');
        if (frame) frame.src = val;
        input.value = val;
      }
    });
  }
}

// 启动时恢复设置
(function() {
  try {
    var saved = localStorage.getItem('xp-blog-font-size');
    if (saved) {
      document.body.style.setProperty('--content-font-size', saved);
    }
    var savedSelect = localStorage.getItem('xp-blog-content-select');
    if (savedSelect) {
      document.body.style.setProperty('--content-select', savedSelect);
    }
  } catch(e) {}
})();
