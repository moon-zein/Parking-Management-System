function $q(sel) {
  return document.querySelector(sel);
}
function $qa(sel) {
  return document.querySelectorAll(sel);
}
function formatTime(ts) {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleString();
}
function hoursBetween(a, b) {
  return Math.max(0, Math.ceil((b - a) / (1000 * 60 * 60)));
}
function calcFee(hours) {
  const ratePerHour = 50;
  return hours * ratePerHour;
}
function initSlots(n = 20) {
  if (localStorage.getItem('parking_slots')) return;
  const slots = [];
  for (let i = 1; i <= n; i++) {
    slots.push({ id: i, status: 'free' });
  }
  localStorage.setItem('parking_slots', JSON.stringify(slots));
}
function getSlots() {
  return JSON.parse(localStorage.getItem('parking_slots') || '[]');
}
function saveSlots(slots) {
  localStorage.setItem('parking_slots', JSON.stringify(slots));
}
function renderSlots() {
  const container = $q('#slotsContainer');
  container.innerHTML = '';
  const slots = getSlots();
  slots.forEach(s => {
    const el = document.createElement('div');
    el.className = 'slot ' + s.status;
    el.dataset.id = s.id;
    el.innerHTML = `<div class="id">Slot ${s.id}</div>
                        <div class="kv">${s.status === 'free' ? 'Available' : (s.status === 'occupied' ? 'Occupied' : 'Reserved')}</div>
                        <small>${s.plate ? s.plate : ''}</small>`;
    el.addEventListener('click', () => openSlotMenu(s.id));
    container.appendChild(el);
  });
  updateStats();
}
function updateStats() {
  const slots = getSlots();
  const total = slots.length;
  const occupied = slots.filter(s => s.status === 'occupied').length;
  const reserved = slots.filter(s => s.status === 'reserved').length;
  const available = total - occupied - reserved;
  $q('#statTotal').textContent = total;
  $q('#statOccupied').textContent = occupied;
  $q('#statReserved').textContent = reserved;
  $q('#statAvailable').textContent = available;
}
function openSlotMenu(id) {
  const slots = getSlots();
  const s = slots.find(x => x.id === id);
  $q('#slotId').textContent = `Slot ${s.id}`;
  $q('#selectedSlotId').value = s.id;
  $q('#entryPlate').value = s.plate || '';
  if (s.status === 'free') {
    showModal('entryModal');
  } else if (s.status === 'occupied') {
    const entry = s.entryTime ? new Date(s.entryTime) : new Date();
    $q('#exitInfo').textContent = `Plate: ${s.plate || '-'} — Entered: ${formatTime(s.entryTime)}`;
    const now = Date.now();
    const hours = hoursBetween(s.entryTime || now, now);
    $q('#exitHours').textContent = hours;
    $q('#exitFee').textContent = calcFee(hours);
    showModal('exitModal');
  } else if (s.status === 'reserved') {
    $q('#resPlate').textContent = s.plate || '-';
    $q('#resUntil').textContent = s.reservedUntil ? formatTime(s.reservedUntil) : '-';
    showModal('reserveViewModal');
  }
}
function vehicleEntry(e) {
  e.preventDefault();
  const slotId = parseInt($q('#selectedSlotId').value, 10);
  const plate = $q('#entryPlate').value.trim();
  const autoAssign = $q('#autoAssign').checked;
  let slots = getSlots();
  let targetSlot = null;
  if (autoAssign) {
    targetSlot = slots.find(s => s.status === 'free');
    if (!targetSlot) {
      alert('No free slots available');
      return;
    }
  } else {
    targetSlot = slots.find(s => s.id === slotId);
    if (!targetSlot) {
      alert('Slot not found');
      return;
    }
    if (targetSlot.status !== 'free') {
      alert('Slot is not free');
      return;
    }
  }
  targetSlot.status = 'occupied';
  targetSlot.plate = plate || 'UNKNOWN';
  targetSlot.entryTime = Date.now();
  saveSlots(slots);
  renderSlots();
  hideModal('entryModal');
}
function vehicleExit(e) {
  e.preventDefault();
  const slotId = parseInt($q('#selectedSlotId').value, 10);
  let slots = getSlots();
  const s = slots.find(x => x.id === slotId);
  if (!s || s.status !== 'occupied') {
    alert('Invalid operation');
    return;
  }
  const now = Date.now();
  const hours = hoursBetween(s.entryTime || now, now);
  const fee = calcFee(hours);
  if (confirm(`Total due: ${fee} (for ${hours} hours). Process payment?`)) {
    s.status = 'free';
    delete s.plate;
    delete s.entryTime;
    delete s.expectedExit;
    saveSlots(slots);
    renderSlots();
    hideModal('exitModal');
    alert('Payment processed. Slot freed.');
  }
}
function openReserveDialog(slotId) {
  const slots = getSlots();
  const s = slots.find(x => x.id === slotId);
  $q('#reserveSlotId').value = slotId;
  $q('#reservePlate').value = '';
  showModal('reserveModal');
}
function makeReservation(e) {
  e.preventDefault();
  const slotId = parseInt($q('#reserveSlotId').value, 10);
  const plate = $q('#reservePlate').value.trim() || 'RESV';
  const durationHours = parseInt($q('#reserveDuration').value, 10) || 1;
  const slots = getSlots();
  const s = slots.find(x => x.id === slotId);
  if (!s) {
    alert('Slot not found');
    return;
  }
  if (s.status !== 'free') {
    alert('Slot is not available for reservation');
    return;
  }
  s.status = 'reserved';
  s.plate = plate;
  s.reservedUntil = Date.now() + durationHours * 60 * 60 * 1000;
  saveSlots(slots);
  renderSlots();
  hideModal('reserveModal');
  alert('Reservation confirmed');
}
function cancelReservation() {
  const slotId = parseInt($q('#selectedSlotId').value, 10);
  let slots = getSlots();
  const s = slots.find(x => x.id === slotId);
  if (!s || s.status !== 'reserved') {
    alert('No reservation');
    return;
  }
  if (confirm('Cancel reservation?')) {
    s.status = 'free';
    delete s.plate;
    delete s.reservedUntil;
    saveSlots(slots);
    renderSlots();
    hideModal('reserveViewModal');
  }
}
function extendReservation(e) {
  e.preventDefault();
  const slotId = parseInt($q('#extendSlotId').value, 10);
  const addHours = parseInt($q('#extendHours').value, 10) || 1;
  const slots = getSlots();
  const s = slots.find(x => x.id === slotId);
  if (!s || (s.status !== 'reserved' && s.status !== 'occupied')) {
    alert('Cannot extend this slot');
    return;
  }
  if (s.status === 'reserved') {
    s.reservedUntil = (s.reservedUntil || Date.now()) + addHours * 60 * 60 * 1000;
  } else {
    s.expectedExit = (s.expectedExit || Date.now()) + addHours * 60 * 60 * 1000;
  }
  saveSlots(slots);
  renderSlots();
  hideModal('extendModal');
  alert('Time extended');
}
function showModal(id) {
  $q('#modalBackdrop').style.display = 'flex';
  $q('#' + id).style.display = 'block';
}
function hideModal(id) {
  $q('#' + id).style.display = 'none';
  $q('#modalBackdrop').style.display = 'none';
}
function addSlot() {
  const slots = getSlots();
  const newId = slots.length ? slots[slots.length - 1].id + 1 : 1;
  slots.push({ id: newId, status: 'free' });
  saveSlots(slots);
  renderSlots();
}
function resetData() {
  if (confirm('Reset demo data?')) {
    localStorage.removeItem('parking_slots');
    initSlots(20);
    renderSlots();
  }
}
document.addEventListener('DOMContentLoaded', () => {
  initSlots(20);
  renderSlots();
  $q('#entryForm').addEventListener('submit', vehicleEntry);
  $q('#exitForm').addEventListener('submit', vehicleExit);
  $q('#reserveForm').addEventListener('submit', makeReservation);
  $q('#extendForm').addEventListener('submit', extendReservation);
  $q('#slotsContainer').addEventListener('contextmenu', function (ev) {
    ev.preventDefault();
    const el = ev.target.closest('.slot');
    if (!el) return;
    const id = parseInt(el.dataset.id, 10);
    openReserveDialog(id);
  });
  const switchMode = document.getElementById('switch-mode');
  if (switchMode) {
    switchMode.addEventListener('change', function () {
      if (!this.checked) {
        document.body.classList.add('dark');
        localStorage.setItem('darkMode', 'true');
      } else {
        document.body.classList.remove('dark');
        localStorage.setItem('darkMode', 'false');
      }
    });
    if (localStorage.getItem('darkMode') === 'true') {
      switchMode.checked = false;
      document.body.classList.add('dark');
    } else {
      switchMode.checked = true;
      document.body.classList.remove('dark');
    }
  }
  const menuToggle = document.querySelector('#menu-toggle');
  const sidebar = document.querySelector('#sidebar');
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('hide');
  });
});
