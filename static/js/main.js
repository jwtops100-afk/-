/* ================================================
   해성전력계통 – main.js
   ================================================ */

// ── 상태 ──────────────────────────────────────────
let buildings = INITIAL_BUILDINGS || [];
let editMode  = false;
let selectedColor = '#1a73e8';
let currentFloorBuildingId = null;  // 층수 모달에서 참조 중인 건물 ID

// ── 초기화 ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  loadStoredMap();

  const toggle = document.getElementById('editModeToggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      editMode = e.target.checked;
      document.getElementById('editTools').style.display = editMode ? 'flex' : 'none';
      document.getElementById('editHint').style.display  = editMode ? 'block' : 'none';
      renderAll();
    });
  }
});

// ── 렌더링 ─────────────────────────────────────────
function renderAll() {
  const layer = document.getElementById('buildingsLayer');
  layer.innerHTML = '';
  buildings.forEach(b => layer.appendChild(createBuildingEl(b)));
}

function createBuildingEl(b) {
  const el = document.createElement('div');
  el.className = 'building-icon' + (editMode ? ' edit-mode' : '');
  el.id = `building-${b.id}`;
  el.style.left = b.x + '%';
  el.style.top  = b.y + '%';

  // 화살표 색상은 CSS currentColor로 처리
  const badge = document.createElement('div');
  badge.className = 'building-badge';
  badge.style.background = b.color || '#1a73e8';
  badge.style.color      = b.color || '#1a73e8';  // for ::after pseudo
  badge.innerHTML = buildingIconSVG();

  const label = document.createElement('div');
  label.className = 'building-label';
  label.textContent = b.name;

  el.appendChild(badge);
  el.appendChild(label);

  // 클릭: 편집모드면 드래그만, 아니면 층수 팝업
  el.addEventListener('click', (e) => {
    if (editMode) return;
    openFloorModal(b.id);
  });

  // 드래그 (관리자 편집모드)
  if (USER_ROLE === 'admin') {
    el.addEventListener('mousedown', onDragStart);
    el.addEventListener('touchstart', onTouchStart, { passive: false });
  }

  return el;
}

function buildingIconSVG() {
  return `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 21h18v-2H3v2zM5 8v11h3V8H5zm5.5 0v11h3V8h-3zM19 8v11h3V8h-3zm-6.75-7L3 7h18L12.25 1z"/>
  </svg>`;
}

// ── 드래그 (마우스) ────────────────────────────────
let dragEl = null, dragId = null, dragOffset = { x: 0, y: 0 };

function onDragStart(e) {
  if (!editMode) return;
  e.preventDefault();
  dragEl = e.currentTarget;
  dragId = parseInt(dragEl.id.replace('building-', ''));

  const wrapper = document.getElementById('mapWrapper');
  const rect = wrapper.getBoundingClientRect();
  const elRect = dragEl.getBoundingClientRect();

  dragOffset.x = e.clientX - elRect.left - elRect.width / 2;
  dragOffset.y = e.clientY - elRect.top  - elRect.height / 2;

  dragEl.classList.add('dragging');
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup',   onDragEnd);
}

function onDragMove(e) {
  if (!dragEl) return;
  const wrapper = document.getElementById('mapWrapper');
  const rect    = wrapper.getBoundingClientRect();

  let px = (e.clientX - dragOffset.x - rect.left) / rect.width  * 100;
  let py = (e.clientY - dragOffset.y - rect.top)  / rect.height * 100;

  px = Math.max(2, Math.min(98, px));
  py = Math.max(2, Math.min(98, py));

  dragEl.style.left = px + '%';
  dragEl.style.top  = py + '%';
}

function onDragEnd(e) {
  if (!dragEl) return;
  dragEl.classList.remove('dragging');

  const wrapper = document.getElementById('mapWrapper');
  const rect    = wrapper.getBoundingClientRect();

  let px = (e.clientX - dragOffset.x - rect.left) / rect.width  * 100;
  let py = (e.clientY - dragOffset.y - rect.top)  / rect.height * 100;
  px = Math.max(2, Math.min(98, px));
  py = Math.max(2, Math.min(98, py));

  updateBuildingPosition(dragId, px, py);

  dragEl = null; dragId = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragEnd);
}

// ── 드래그 (터치) ──────────────────────────────────
let touchDragEl = null, touchDragId = null, touchOffset = { x: 0, y: 0 };

function onTouchStart(e) {
  if (!editMode) return;
  e.preventDefault();
  const touch = e.touches[0];
  touchDragEl = e.currentTarget;
  touchDragId = parseInt(touchDragEl.id.replace('building-', ''));

  const elRect = touchDragEl.getBoundingClientRect();
  touchOffset.x = touch.clientX - elRect.left - elRect.width / 2;
  touchOffset.y = touch.clientY - elRect.top  - elRect.height / 2;

  touchDragEl.classList.add('dragging');
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend',  onTouchEnd);
}

function onTouchMove(e) {
  if (!touchDragEl) return;
  e.preventDefault();
  const touch = e.touches[0];
  const wrapper = document.getElementById('mapWrapper');
  const rect    = wrapper.getBoundingClientRect();

  let px = (touch.clientX - touchOffset.x - rect.left) / rect.width  * 100;
  let py = (touch.clientY - touchOffset.y - rect.top)  / rect.height * 100;
  px = Math.max(2, Math.min(98, px));
  py = Math.max(2, Math.min(98, py));

  touchDragEl.style.left = px + '%';
  touchDragEl.style.top  = py + '%';
}

function onTouchEnd(e) {
  if (!touchDragEl) return;
  const touch = e.changedTouches[0];
  const wrapper = document.getElementById('mapWrapper');
  const rect    = wrapper.getBoundingClientRect();

  let px = (touch.clientX - touchOffset.x - rect.left) / rect.width  * 100;
  let py = (touch.clientY - touchOffset.y - rect.top)  / rect.height * 100;
  px = Math.max(2, Math.min(98, px));
  py = Math.max(2, Math.min(98, py));

  updateBuildingPosition(touchDragId, px, py);

  touchDragEl.classList.remove('dragging');
  touchDragEl = null; touchDragId = null;
  document.removeEventListener('touchmove', onTouchMove);
  document.removeEventListener('touchend',  onTouchEnd);
}

// ── API 헬퍼 ──────────────────────────────────────
async function apiFetch(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── 건물 위치 저장 ─────────────────────────────────
async function updateBuildingPosition(id, x, y) {
  const b = buildings.find(b => b.id === id);
  if (!b) return;
  b.x = +x.toFixed(2);
  b.y = +y.toFixed(2);
  try {
    await apiFetch(`/api/buildings/${id}`, 'PUT', { x: b.x, y: b.y });
  } catch(err) { console.error('위치 저장 실패', err); }
}

// ── 건물 추가 모달 ─────────────────────────────────
function openAddBuildingModal() {
  document.getElementById('modalTitle').textContent = '건물 추가';
  document.getElementById('modalBuildingId').value = '';
  document.getElementById('modalBuildingName').value = '';
  selectedColor = '#1a73e8';
  syncColorPalette();
  renderFloorEditor(['1F']);
  document.getElementById('buildingModal').style.display = 'flex';
}

function openEditBuildingModal(id) {
  const b = buildings.find(b => b.id === id);
  if (!b) return;
  document.getElementById('modalTitle').textContent = '건물 편집';
  document.getElementById('modalBuildingId').value = b.id;
  document.getElementById('modalBuildingName').value = b.name;
  selectedColor = b.color || '#1a73e8';
  syncColorPalette();
  renderFloorEditor(b.floors || []);
  document.getElementById('buildingModal').style.display = 'flex';
}

function closeBuildingModal() {
  document.getElementById('buildingModal').style.display = 'none';
}

async function saveBuilding() {
  const idVal = document.getElementById('modalBuildingId').value;
  const name  = document.getElementById('modalBuildingName').value.trim() || '건물';
  const floors = collectFloors();
  const color  = selectedColor;

  if (idVal) {
    // 수정
    const id = parseInt(idVal);
    try {
      const updated = await apiFetch(`/api/buildings/${id}`, 'PUT', { name, floors, color });
      const idx = buildings.findIndex(b => b.id === id);
      if (idx !== -1) buildings[idx] = updated;
    } catch(err) { alert('저장 실패: ' + err.message); return; }
  } else {
    // 추가 (지도 중앙에 배치)
    try {
      const nb = await apiFetch('/api/buildings', 'POST', { name, floors, color, x: 50, y: 50 });
      buildings.push(nb);
    } catch(err) { alert('추가 실패: ' + err.message); return; }
  }
  closeBuildingModal();
  renderAll();
}

// ── 층수 편집기 ────────────────────────────────────
function renderFloorEditor(floors) {
  const ed = document.getElementById('floorEditor');
  ed.innerHTML = '';
  floors.forEach((f, i) => {
    ed.appendChild(createFloorRow(f));
  });
}

function createFloorRow(value) {
  const row = document.createElement('div');
  row.className = 'floor-row';
  row.innerHTML = `
    <span class="floor-handle" title="드래그로 순서 변경">☰</span>
    <input class="floor-input" type="text" value="${escapeHtml(value)}" placeholder="예: 1F, B1" />
    <button class="btn-del-floor" onclick="removeFloorRow(this)">삭제</button>
  `;
  return row;
}

function addFloorRow() {
  const ed = document.getElementById('floorEditor');
  const rows  = ed.querySelectorAll('.floor-row');
  const last  = rows.length > 0 ? rows[rows.length - 1].querySelector('.floor-input').value : null;
  const nextVal = guessNextFloor(last);
  ed.appendChild(createFloorRow(nextVal));
}

function removeFloorRow(btn) {
  btn.closest('.floor-row').remove();
}

function collectFloors() {
  return Array.from(document.querySelectorAll('#floorEditor .floor-input'))
    .map(i => i.value.trim()).filter(v => v);
}

function guessNextFloor(last) {
  if (!last) return '1F';
  const m = last.match(/^(-?\d+)F$/i);
  if (m) return (parseInt(m[1]) + 1) + 'F';
  const mb = last.match(/^B(\d+)$/i);
  if (mb) return 'B' + (parseInt(mb[1]) + 1);
  return '';
}

// ── 색상 선택 ──────────────────────────────────────
function selectColor(el) {
  selectedColor = el.dataset.color;
  syncColorPalette();
}

function setCustomColor(val) {
  selectedColor = val;
  document.querySelectorAll('.cp-swatch').forEach(s => s.classList.remove('active'));
}

function syncColorPalette() {
  document.querySelectorAll('.cp-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === selectedColor);
  });
  const cc = document.getElementById('customColor');
  if (cc) cc.value = selectedColor;
}

// ── 층수 모달 ──────────────────────────────────────
function openFloorModal(id) {
  const b = buildings.find(b => b.id === id);
  if (!b) return;
  currentFloorBuildingId = id;
  document.getElementById('floorModalTitle').textContent = b.name;
  document.getElementById('floorModalHeader').style.borderColor = b.color || '#1a73e8';

  const grid = document.getElementById('floorGrid');
  grid.innerHTML = '';
  (b.floors || []).slice().reverse().forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'floor-btn';
    btn.textContent = f;
    btn.style.setProperty('--hover-color', b.color || '#1a73e8');
    btn.addEventListener('click', () => {
      // TODO: 층 선택 시 다음 화면으로 이동 (추후 추가 예정)
      console.log(`건물: ${b.name}, 층: ${f}`);
      closeFloorModal();
    });
    grid.appendChild(btn);
  });

  document.getElementById('floorModal').style.display = 'flex';
}

function closeFloorModal() {
  document.getElementById('floorModal').style.display = 'none';
  currentFloorBuildingId = null;
}

function editBuildingFromFloor() {
  if (currentFloorBuildingId == null) return;
  closeFloorModal();
  openEditBuildingModal(currentFloorBuildingId);
}

async function deleteBuildingFromFloor() {
  if (currentFloorBuildingId == null) return;
  const b = buildings.find(b => b.id === currentFloorBuildingId);
  if (!b) return;
  if (!confirm(`"${b.name}" 건물을 삭제하시겠습니까?`)) return;
  try {
    await apiFetch(`/api/buildings/${b.id}`, 'DELETE');
    buildings = buildings.filter(x => x.id !== b.id);
    closeFloorModal();
    renderAll();
  } catch(err) { alert('삭제 실패: ' + err.message); }
}

// ── 지도 이미지 업로드 ─────────────────────────────
async function uploadMap(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('map_image', file);
  try {
    const res = await fetch('/api/upload-map', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('업로드 실패');
    const data = await res.json();
    applyMapImage(data.url + '?t=' + Date.now());
    localStorage.setItem('mapImageUrl', data.url);
  } catch(err) { alert('지도 업로드 실패: ' + err.message); }
}

function applyMapImage(url) {
  const bg   = document.getElementById('mapBg');
  const ph   = document.getElementById('mapPlaceholder');

  let img = bg.querySelector('img');
  if (!img) {
    img = document.createElement('img');
    img.alt = '사업장 지도';
    bg.insertBefore(img, ph);
  }
  img.src = url;
  if (ph) ph.style.display = 'none';
}

function loadStoredMap() {
  // 서버 업로드 이미지 URL 시도
  const serverUrl = '/static/uploads/site_map.png';
  const img = new Image();
  img.onload  = () => applyMapImage(serverUrl + '?t=' + Date.now());
  img.onerror = () => {};
  img.src = serverUrl;
}

// ── 유틸 ───────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 모달 외부 클릭으로 닫기
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    closeBuildingModal();
    closeFloorModal();
  }
});
