(function () {
  if (document.getElementById('main-tool-btn')) return;

  // -- small constants (keeps original IDs unchanged) --
  const PANEL_STORAGE_KEY = 'assistant_panel_open_v1';
  const FAB_POS_KEY = 'assistant_fab_pos_v1';

  // -----------------------
  // 创建可拖拽悬浮球（保留原 id，不改其它 id/文本结构）
  // -----------------------
  const mainBtn = document.createElement('button');
  mainBtn.id = 'main-tool-btn';
  mainBtn.title = '打开助手面板';
  mainBtn.type = 'button';
  mainBtn.textContent = '🤝';
  Object.assign(mainBtn.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: 99999,
    width: '50px',
    height: '50px',
    backgroundColor: '#32e27e',
    border: 'none',
    borderRadius: '50%',
    color: 'white',
    fontWeight: '600',
    cursor: 'grab',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    transition: 'background-color 0.18s ease, transform 0.08s ease',
    userSelect: 'none',
  });
  mainBtn.addEventListener('mouseenter', () => { mainBtn.style.backgroundColor = '#28c46f'; });
  mainBtn.addEventListener('mouseleave', () => { mainBtn.style.backgroundColor = '#32e27e'; });
  document.body.appendChild(mainBtn);

  // 恢复悬浮球位置（如果有）
  try {
    const pos = JSON.parse(localStorage.getItem(FAB_POS_KEY));
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      Object.assign(mainBtn.style, { left: pos.x + 'px', top: pos.y + 'px', right: 'auto', bottom: 'auto', transform: 'none' });
    }
  } catch (e) { /* ignore */ }

  // 拖拽逻辑（pointer events）
  let dragging = false;
  let dragStart = { x: 0, y: 0 };
  let btnStart = { x: 0, y: 0 };
  let moved = 0;
  const MOVE_THRESHOLD = 6; // px
  function getViewportPos(evt) { return { x: evt.clientX, y: evt.clientY }; }

  mainBtn.addEventListener('pointerdown', (ev) => {
    if (ev.button && ev.button !== 0) return;
    ev.preventDefault();
    mainBtn.setPointerCapture(ev.pointerId);
    dragging = true;
    mainBtn.style.cursor = 'grabbing';
    dragStart = getViewportPos(ev);
    const rect = mainBtn.getBoundingClientRect();
    btnStart.x = rect.left;
    btnStart.y = rect.top;
    moved = 0;
  });

  mainBtn.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    const cur = getViewportPos(ev);
    const dx = cur.x - dragStart.x;
    const dy = cur.y - dragStart.y;
    moved += Math.abs(dx) + Math.abs(dy);
    const newLeft = Math.max(4, Math.min(window.innerWidth - mainBtn.offsetWidth - 4, btnStart.x + dx));
    const newTop = Math.max(4, Math.min(window.innerHeight - mainBtn.offsetHeight - 4, btnStart.y + dy));
    Object.assign(mainBtn.style, { left: newLeft + 'px', top: newTop + 'px', right: 'auto', bottom: 'auto', transform: 'none' });
    btnStart.x = newLeft;
    btnStart.y = newTop;
    dragStart = cur;
  });

  mainBtn.addEventListener('pointerup', (ev) => {
    if (!dragging) return;
    try { mainBtn.releasePointerCapture(ev.pointerId); } catch (e) {}
    dragging = false;
    mainBtn.style.cursor = 'grab';
    if (moved < MOVE_THRESHOLD) {
      // treat as click - toggle handled in pointerup for reliable click/drag distinction
      togglePanelDisplay();
    } else {
      const rect = mainBtn.getBoundingClientRect();
      const pos = { x: rect.left, y: rect.top };
      try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(pos)); } catch (e) {}
    }
  });

  window.addEventListener('pointercancel', () => {
    if (!dragging) return;
    dragging = false;
    mainBtn.style.cursor = 'grab';
    const rect = mainBtn.getBoundingClientRect();
    try { localStorage.setItem(FAB_POS_KEY, JSON.stringify({ x: rect.left, y: rect.top })); } catch (e) {}
  });

  // -----------------------
  // 主面板（保持你原有 panel 布局与样式），但不固定到页面中央
  // -----------------------
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed',
    width: '400px',
    maxHeight: '500px',
    overflowY: 'auto',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
    padding: '15px 20px',
    zIndex: 99999,
    display: 'none',
    fontSize: '13px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    color: '#333',
    boxSizing: 'border-box',
  });
  document.body.appendChild(panel);

  // 当面板打开时，会调用此函数把 panel 放置在 FAB 附近并保证可视区域内
  function positionPanelNearFAB() {
    const fabRect = mainBtn.getBoundingClientRect();
    const panelW = 400;
    const panelH = Math.min(500, panel.scrollHeight || 300);
    const spacing = 8; // 空隙
    // 首选：放在 FAB 上方并水平居中于 FAB
    let left = fabRect.left + (fabRect.width / 2) - (panelW / 2);
    let top = fabRect.top - panelH - spacing;
    // 如果上方空间不足，放在 FAB 下方
    if (top < 6) {
      top = fabRect.bottom + spacing;
    }
    // 确保不超出左右边界
    left = Math.max(6, Math.min(window.innerWidth - panelW - 6, left));
    // 确保不超出底部
    top = Math.max(6, Math.min(window.innerHeight - panelH - 6, top));
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.transform = 'none';
  }

  // 点击页面任意处，若不在 panel 或 FAB 内则收起（拖拽时不触发）
  document.addEventListener('mousedown', (e) => {
    if (dragging) return;
    const target = e.target;
    if (!panel.contains(target) && !mainBtn.contains(target)) {
      if (panel.style.display === 'block') {
        panel.style.display = 'none';
        try { localStorage.setItem(PANEL_STORAGE_KEY, 'false'); } catch (e) {}
      }
    }
  });

  // 窗口大小变化时，如果面板打开则重新对齐
  window.addEventListener('resize', () => {
    if (panel.style.display === 'block') positionPanelNearFAB();
  });

  // ---------- 顶部 tab、关闭按钮、面板内容（完全保留你原始内嵌 HTML） ----------
  const tabsContainer = document.createElement('div');
  tabsContainer.style.display = 'flex';
  tabsContainer.style.justifyContent = 'center';
  tabsContainer.style.gap = '12px';
  tabsContainer.style.marginBottom = '12px';

  const tabTemplateBtn = document.createElement('button');
  tabTemplateBtn.textContent = '预订信息模板';
  tabTemplateBtn.style.padding = '6px 12px';
  tabTemplateBtn.style.border = 'none';
  tabTemplateBtn.style.borderBottom = '2px solid #32e27e';
  tabTemplateBtn.style.background = 'transparent';
  tabTemplateBtn.style.color = '#32e27e';
  tabTemplateBtn.style.fontWeight = '700';
  tabTemplateBtn.style.cursor = 'pointer';

  const tabConfirmBtn = document.createElement('button');
  tabConfirmBtn.textContent = '确认号助手';
  tabConfirmBtn.style.padding = '6px 12px';
  tabConfirmBtn.style.border = 'none';
  tabConfirmBtn.style.background = 'transparent';
  tabConfirmBtn.style.color = '#666';
  tabConfirmBtn.style.cursor = 'pointer';

  tabsContainer.append(tabTemplateBtn, tabConfirmBtn);
  panel.appendChild(tabsContainer);

  // 关闭按钮
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '8px',
    right: '12px',
    background: '#aaa',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px',
  });
  panel.appendChild(closeBtn);

  const templateContent = document.createElement('div');
  templateContent.style.display = 'block';
  templateContent.innerHTML = `
    <h3 style="text-align:center; font-weight:700; color:#2a9df4; margin-top:0; margin-bottom:12px;">选择模板语言及字段</h3>
    <form id="field-select-form" style="user-select:none;">
      <div style="text-align:center; margin-bottom:12px;">
        <label style="margin-right:12px; font-weight:600; font-size:13px;">
          <input type="radio" name="lang" value="cn" checked> 中文模板
        </label>
        <label style="font-weight:600; font-size:13px;">
          <input type="radio" name="lang" value="en"> English Template
        </label>
      </div>

      <div style="margin-bottom:9px; font-size:13px;"><label><input type="checkbox" name="fields" value="orderNum" checked> 订单号 / Agents System Order ID</label></div>
      <div style="margin-bottom:9px; font-size:13px;"><label><input type="checkbox" name="fields" value="hotelName" checked> 酒店名 / Hotel Name</label></div>
      <div style="margin-bottom:9px; font-size:13px;"><label><input type="checkbox" name="fields" value="roomType" checked> 房型 / Room Type</label></div>
      <div style="margin-bottom:9px; font-size:13px;"><label><input type="checkbox" name="fields" value="customerName" checked> 入住人姓名 / Guest Name</label></div>
      <div style="margin-bottom:9px; font-size:13px;"><label><input type="checkbox" name="fields" value="roomCount" checked> 房间数量 / Number of Room</label></div>
      <div style="margin-bottom:9px; font-size:13px;"><label><input type="checkbox" name="fields" value="checkInDate" checked> 入住日期 / Check-in Date</label></div>
      <div style="margin-bottom:9px; font-size:13px;"><label><input type="checkbox" name="fields" value="checkOutDate" checked> 离店日期 / Check-out Date</label></div>
      <div style="margin-bottom:9px; font-size:13px;"><label><input type="checkbox" name="fields" value="nightlyPrice" checked> 每晚房价 / Cost Daily Details</label></div>
      <div style="margin-bottom:9px; font-size:13px;"><label><input type="checkbox" name="fields" value="totalPrice" checked> 总价 / Grand Total Price</label></div>
      <div style="margin-bottom:12px; font-size:13px;"><label><input type="checkbox" name="fields" value="guestRemark"> 客人特殊备注 / Guest Special Remark</label></div>

      <button type="submit" style="
        width: 100%;
        padding: 8px 0;
        background: linear-gradient(to right, #32e27e, #1fc96b);
        border: none;
        border-radius: 6px;
        color: white;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 3px 6px rgba(50, 226, 126, 0.6);
        transition: background-color 0.3s ease;
      ">生成模板 / Generate Template</button>
    </form>
    <textarea id="result-template" style="
      margin-top: 12px;
      width: 100%;
      height: 140px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      resize: none;
      display: none;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid #ddd;
      background-color: #f9f9f9;
      box-sizing: border-box;
      line-height: 1.4;
      color: #222;
    " readonly></textarea>
    <button id="copy-template-btn" style="
      margin-top: 8px;
      width: 100%;
      padding: 8px 0;
      background: linear-gradient(to right, #2a9df4, #1c7ed6);
      border: none;
      border-radius: 6px;
      color: white;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      display: none;
      box-shadow: 0 3px 6px rgba(42, 157, 244, 0.7);
      transition: background-color 0.3s ease;
    ">一键复制 / Copy to Clipboard</button>
  `;

  panel.appendChild(templateContent);

  const confirmContent = document.createElement('div');
  confirmContent.style.display = 'none';
  confirmContent.innerHTML = `
    <div style="display:flex; flex-direction: column; gap: 6px;">
      <button id="groupGenBtn" style="background:#32aaff; color:#fff; border:none; border-radius:6px; padding:6px; cursor:pointer; font-weight:600;">📄 生成群话术</button>
      <textarea id="groupText" rows="3" readonly style="width:100%; font-family: monospace; font-size:14px; resize:none;"></textarea>
      <button id="groupCopyBtn" style="background:#28a745; color:#fff; border:none; border-radius:6px; padding:6px; cursor:pointer; font-weight:600;">📋 复制</button>

      <hr style="margin:12px 0;">

      <button id="emailGenBtn" style="background:#32aaff; color:#fff; border:none; border-radius:6px; padding:6px; cursor:pointer; font-weight:600;">📄 生成邮件话术</button>
      <input id="emailTitle" readonly placeholder="邮件标题" style="width:100%; padding:6px; font-family: monospace; font-size:14px; margin:6px 0; border:1px solid #ccc; border-radius:6px;">
      <textarea id="emailBody" rows="4" readonly style="width:100%; font-family: monospace; font-size:14px; resize:none; margin-bottom:6px;"></textarea>
      <button id="emailCopyBtn" style="background:#28a745; color:#fff; border:none; border-radius:6px; padding:6px; cursor:pointer; font-weight:600; margin-bottom:6px;">📋 复制正文</button>
      <button id="emailCopyAllBtn" style="background:#17a2b8; color:#fff; border:none; border-radius:6px; padding:6px; cursor:pointer; font-weight:600;">📋 复制标题+正文</button>
    </div>
  `;
  panel.appendChild(confirmContent);

  // ---------- 工具函数（兼容性与稳健性改进） ----------
  async function copyToClipboard(text) {
    try {
      if (!text) return false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        const temp = document.createElement('textarea');
        temp.value = text;
        temp.style.position = 'fixed';
        temp.style.left = '-9999px';
        document.body.appendChild(temp);
        temp.select();
        try {
          const ok = document.execCommand('copy');
          document.body.removeChild(temp);
          return ok;
        } catch (e) {
          document.body.removeChild(temp);
          return false;
        }
      }
    } catch (err) {
      console.warn('copyToClipboard error:', err);
      return false;
    }
  }

  function safeText(node) {
    try { return node ? (node.textContent || '').trim() : ''; } catch { return ''; }
  }

  function findByTitleKeyword(keyword) {
    const tds = [...document.querySelectorAll('td.titleTd')];
    let found = tds.find(td => td.textContent.includes(keyword));
    if (found) return found;
    const any = [...document.querySelectorAll('td')].find(td => td.textContent && td.textContent.includes(keyword));
    return any || null;
  }

  function getBookingData() {
    try {
      const orderNumNode = findByTitleKeyword('订单号');
      let orderNum = '';
      if (orderNumNode) {
        const next = orderNumNode.nextElementSibling;
        if (next) {
          if (next.childNodes && next.childNodes.length > 0 && next.childNodes[0].textContent) {
            orderNum = safeText(next.childNodes[0]);
          } else {
            orderNum = safeText(next);
          }
        }
        orderNum = orderNum.replace(/\[.*?\].*$/, '').replace(/\s+/g, ' ').trim();
      }

      const hotelNameNode = findByTitleKeyword('酒店名称');
      let hotelName = '';
      if (hotelNameNode) {
        const next = hotelNameNode.nextElementSibling;
        const text = safeText(next);
        const match = text.match(/\/\s*(.+)/);
        hotelName = match ? match[1].trim() : text;
      }

      const roomTypeNode = findByTitleKeyword('发单房型');
      let roomType = '';
      if (roomTypeNode) {
        const next = roomTypeNode.nextElementSibling;
        const text = safeText(next);
        const match = text.match(/\/\s*(.+)/);
        roomType = match ? match[1].trim() : text;
      }

      const customerNameNode = document.getElementById('lbOrderCustomer');
      const customerName = safeText(customerNameNode);

      const roomCountNode = findByTitleKeyword('房间数量');
      const roomCount = roomCountNode ? safeText(roomCountNode.nextElementSibling) : '';

      const checkInDateNode = findByTitleKeyword('入住日期');
      const checkInDate = checkInDateNode ? safeText(checkInDateNode.nextElementSibling) : '';

      const checkOutDateNode = findByTitleKeyword('离店日期');
      const checkOutDate = checkOutDateNode ? safeText(checkOutDateNode.nextElementSibling) : '';

      const priceItems = [...document.querySelectorAll('.priceitem')];
      let nightlyPrice = '';
      if (priceItems.length > 0) {
        for (const item of priceItems) {
          const txt = safeText(item);
          if (/^\d{4}-\d{2}-\d{2}/.test(txt)) {
            const m = txt.match(/([A-Z]{2,4})\s*[:：]?\s*([\d\.,]+)/);
            if (m) {
              nightlyPrice = `${m[1]} : ${m[2].replace(/,/g,'')}`;
              break;
            }
          }
        }
      }

      let totalPrice = '';
      if (priceItems.length > 0) {
        for (let i = priceItems.length - 1; i >= 0; i--) {
          const txt = safeText(priceItems[i]);
          if (txt.includes('共 ')) {
            const m = txt.match(/共\s*([A-Z]{2,4})\s*[:：]?\s*([\d\.,]+)/);
            if (m) {
              totalPrice = `${m[1]} : ${m[2].replace(/,/g,'')}`;
              break;
            }
          }
        }
      }

      let guestRemark = '';
      const remarkLabel = [...document.querySelectorAll('label[style*="color: blue"]')].find(label => label.textContent.includes('客人特殊备注'))
        || [...document.querySelectorAll('label')].find(label => label.textContent && label.textContent.includes('客人特殊备注'));
      if (remarkLabel) {
        const text = safeText(remarkLabel);
        const parts = text.split('：');
        if (parts.length > 1) guestRemark = parts.slice(1).join('：').trim();
        else {
          const next = remarkLabel.nextElementSibling;
          guestRemark = safeText(next);
        }
      }

      return {
        orderNum, hotelName, roomType, customerName,
        roomCount, checkInDate, checkOutDate,
        nightlyPrice, totalPrice, guestRemark
      };
    } catch (err) {
      console.warn('getBookingData error:', err);
      return {
        orderNum: '', hotelName: '', roomType: '', customerName: '',
        roomCount: '', checkInDate: '', checkOutDate: '',
        nightlyPrice: '', totalPrice: '', guestRemark: ''
      };
    }
  }

  function generateTemplate(selectedFields, lang) {
    const data = getBookingData();
    const labelsCN = {
      orderNum: '订单号', hotelName: '酒店名', roomType: '房型',
      customerName: '入住人姓名', roomCount: '房间数量', checkInDate: '入住日期',
      checkOutDate: '离店日期', nightlyPrice: '每晚房价', totalPrice: '总价',
      guestRemark: '客人特殊备注',
    };
    const labelsEN = {
      orderNum: 'Agents System Order ID', hotelName: 'Hotel Name', roomType: 'Room Type',
      customerName: 'Guest Name', roomCount: 'Number of Room', checkInDate: 'Check-in Date',
      checkOutDate: 'Check-out Date', nightlyPrice: 'Cost Daily Details', totalPrice: 'Grand Total Price',
      guestRemark: 'Guest Special Remark',
    };
    const labels = lang === 'en' ? labelsEN : labelsCN;
    const lines = [];
    if (lang === 'en') lines.push("Dear Hotel, Please confirm below booking:\n");
    for (const field of selectedFields) {
      if (data[field]) lines.push(`${labels[field]}: ${data[field]}`);
      else lines.push(`${labels[field]}: `);
    }
    return lines.join('\n');
  }

  // 绑定预订信息模板表单事件（保持原逻辑）
  templateContent.querySelector('form').onsubmit = function (e) {
    e.preventDefault();
    const lang = this.elements['lang'].value;
    const checkedFields = [...this.elements['fields']].filter(chk => chk.checked).map(chk => chk.value);
    if (checkedFields.length === 0) {
      alert('请至少选择一个字段 / Please select at least one field');
      return;
    }
    const tpl = generateTemplate(checkedFields, lang);
    const resultArea = templateContent.querySelector('#result-template');
    resultArea.value = tpl || (lang === 'en' ? 'No data' : '无数据');
    resultArea.style.display = 'block';
    const copyBtn = templateContent.querySelector('#copy-template-btn');
    copyBtn.style.display = 'block';
    resultArea.select();
  };

  templateContent.querySelector('#copy-template-btn').onclick = async function () {
    const resultArea = templateContent.querySelector('#result-template');
    if (!resultArea.value) {
      alert('没有可复制的内容 / No content to copy');
      return;
    }
    const ok = await copyToClipboard(resultArea.value);
    if (ok) {
      this.textContent = '已复制 ✓ / Copied ✓';
      setTimeout(() => { this.textContent = '一键复制 / Copy to Clipboard'; }, 2000);
    } else {
      alert('复制失败，请手动复制 / Copy failed, please copy manually');
    }
  };

  // 确认号助手相关（保持原逻辑）
  const getConfirmCode = () => document.getElementById("confirmationnumber")?.value?.trim() || "";
  const getOrderCode = () => {
    const tds = document.querySelectorAll("td");
    for (let i = 0; i < tds.length; i++) {
      const text = tds[i].innerText || '';
      if (text.includes("渠道订单号：") || text.includes("渠道订单号")) {
        const nextTd = tds[i + 1];
        if (nextTd) {
          const raw = (nextTd.textContent || "").trim();
          const token = raw.split(/\s+/)[0] || raw;
          return token.replace(/\[.*?\].*$/, '').trim();
        }
      }
    }
    const bodyText = document.body.innerText || '';
    const m = bodyText.match(/渠道订单号[:：]?\s*([^\s\[\]]+)/);
    if (m) return m[1].replace(/\[.*?\].*$/, '').trim();
    return "";
  };

  const groupGenBtn = confirmContent.querySelector("#groupGenBtn");
  const groupText = confirmContent.querySelector("#groupText");
  const groupCopyBtn = confirmContent.querySelector("#groupCopyBtn");
  const emailGenBtn = confirmContent.querySelector("#emailGenBtn");
  const emailTitle = confirmContent.querySelector("#emailTitle");
  const emailBody = confirmContent.querySelector("#emailBody");
  const emailCopyBtn = confirmContent.querySelector("#emailCopyBtn");
  const emailCopyAllBtn = confirmContent.querySelector("#emailCopyAllBtn");

  groupGenBtn.onclick = () => {
    const confirm = getConfirmCode();
    const order = getOrderCode();
    groupText.value = confirm && order
      ? `${order}   请注意，订单确认号已更新为 [${confirm}]（原确认号失效）。请告知客人携带新确认号及预订人姓名至酒店办理入住。如有疑问，请随时联系我们。`
      : "❌ 未找到确认号或渠道订单号";
  };
  groupCopyBtn.onclick = async () => {
    const text = groupText.value || '';
    const ok = await copyToClipboard(text);
    if (ok) {
      groupCopyBtn.textContent = "✅ 已复制";
      setTimeout(() => (groupCopyBtn.textContent = "📋 复制"), 1500);
    } else {
      alert('复制失败，请手动复制 / Copy failed, please copy manually');
    }
  };

  emailGenBtn.onclick = () => {
    const confirm = getConfirmCode();
    const order = getOrderCode();
    if (!confirm || !order) {
      emailTitle.value = "";
      emailBody.value = "❌ 未找到确认号或渠道订单号";
      return;
    }
    emailTitle.value = `Update order confirmation number/Order number：${order}`;
    emailBody.value = `Please note that the order confirmation number updated to [${confirm}] (original invalid). Please inform the guest to bring the new confirmation number and the name of the booking person to the hotel for check-in. If you have any questions, please feel free to contact us.`;
  };
  emailCopyBtn.onclick = async () => {
    const ok = await copyToClipboard(emailBody.value || '');
    if (ok) {
      emailCopyBtn.textContent = "✅ 已复制正文";
      setTimeout(() => (emailCopyBtn.textContent = "📋 复制正文"), 1500);
    } else {
      alert('复制失败，请手动复制 / Copy failed, please copy manually');
    }
  };
  emailCopyAllBtn.onclick = async () => {
    const tempText = `${emailTitle.value}\n\n${emailBody.value}`;
    const ok = await copyToClipboard(tempText);
    if (ok) {
      emailCopyAllBtn.textContent = "✅ 已复制全部";
      setTimeout(() => (emailCopyAllBtn.textContent = "📋 复制标题+正文"), 1500);
    } else {
      alert('复制失败，请手动复制 / Copy failed, please copy manually');
    }
  };

  // tab 切换函数（保持原样）
  function switchTab(toTemplate) {
    if (toTemplate) {
      tabTemplateBtn.style.borderBottom = '2px solid #32e27e';
      tabTemplateBtn.style.color = '#32e27e';
      tabConfirmBtn.style.borderBottom = 'none';
      tabConfirmBtn.style.color = '#666';
      templateContent.style.display = 'block';
      confirmContent.style.display = 'none';
    } else {
      tabConfirmBtn.style.borderBottom = '2px solid #32e27e';
      tabConfirmBtn.style.color = '#32e27e';
      tabTemplateBtn.style.borderBottom = 'none';
      tabTemplateBtn.style.color = '#666';
      templateContent.style.display = 'none';
      confirmContent.style.display = 'block';
    }
  }
  tabTemplateBtn.onclick = () => switchTab(true);
  tabConfirmBtn.onclick = () => switchTab(false);

  closeBtn.onclick = () => {
    panel.style.display = 'none';
    try { localStorage.setItem(PANEL_STORAGE_KEY, 'false'); } catch(e) {}
  };

  // toggle 面板并放置到 FAB 附近
  function togglePanelDisplay() {
    const newDisplay = panel.style.display === 'none' ? 'block' : 'none';
    panel.style.display = newDisplay;
    try { localStorage.setItem(PANEL_STORAGE_KEY, newDisplay === 'block' ? 'true' : 'false'); } catch(e) {}
    if (newDisplay === 'block') {
      // 尝试短延迟以确保 panel 的 scrollHeight 等已反映
      setTimeout(positionPanelNearFAB, 8);
    }
  }

  // 恢复悬浮球与面板状态
  try {
    const v = localStorage.getItem(PANEL_STORAGE_KEY);
    if (v === 'true') {
      panel.style.display = 'block';
      setTimeout(positionPanelNearFAB, 8);
    }
  } catch (e) {}

  // 默认打开第一个 tab
  switchTab(true);
})();
