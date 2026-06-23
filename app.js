/* ==========================================================================
   Exam Bank System - app.js
   IndexedDB operations, CRUD management, Exam Generation, A4 Print Pagination
   ========================================================================== */

// Database Configuration
const DB_NAME = 'ExamBankDB';
const DB_VERSION = 1;
let db = null;

// Application State
let categories = [];
let questions = [];
let activeTab = 'dashboard';
let editingQuestionId = null;
let currentQuestionImageBase64 = null;
let generatedExamQuestions = [];

// DOM Elements
const sidebarButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeText = document.getElementById('theme-text');
const sunIcon = document.querySelector('.sun-icon');
const moonIcon = document.querySelector('.moon-icon');

// Modals & Form triggers
const quickAddBtn = document.getElementById('quick-add-btn');
const questionModal = document.getElementById('question-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const questionForm = document.getElementById('question-form');

// File Upload
const questionImageInput = document.getElementById('question-image-input');
const imageUploadTrigger = document.getElementById('image-upload-trigger');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreviewElement = document.getElementById('image-preview-element');
const removeImageBtn = document.getElementById('remove-image-btn');

// Print Preview
const printPreviewContainer = document.getElementById('print-preview-container');
const backToGenBtn = document.getElementById('back-to-gen-btn');
const toggleViewExamBtn = document.getElementById('toggle-view-exam-btn');
const toggleViewKeyBtn = document.getElementById('toggle-view-key-btn');
const printExamBtn = document.getElementById('print-exam-btn');
const paperViewport = document.getElementById('paper-viewport');
const previewExamName = document.getElementById('preview-exam-name');

// Forms & Inputs
const categoryForm = document.getElementById('category-form');
const categoryNameInput = document.getElementById('category-name-input');
const generatorForm = document.getElementById('generator-form');

// Filters
const searchQuestionInput = document.getElementById('search-question-input');
const filterCategorySelect = document.getElementById('filter-category-select');

// ==========================================
// 1. Database Operations (IndexedDB)
// ==========================================

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = function(e) {
      const db = e.target.result;
      
      // Store 1: Categories
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
      }
      
      // Store 2: Questions
      if (!db.objectStoreNames.contains('questions')) {
        const questionStore = db.createObjectStore('questions', { keyPath: 'id', autoIncrement: true });
        questionStore.createIndex('categoryId', 'categoryId', { unique: false });
      }
    };

    request.onsuccess = function(e) {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = function(e) {
      console.error('Database opening error:', e.target.error);
      reject(e.target.error);
    };
  });
}

function getStoreData(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = function() {
      resolve(request.result);
    };

    request.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

function addData(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);

    request.onsuccess = function(e) {
      resolve(e.target.result);
    };

    request.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

function updateData(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = function() {
      resolve();
    };

    request.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

function deleteData(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = function() {
      resolve();
    };

    request.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

// Clear all data
function clearDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) return reject('Database not initialized');
    const transaction = db.transaction(['categories', 'questions'], 'readwrite');
    transaction.objectStore('categories').clear();
    transaction.objectStore('questions').clear();

    transaction.oncomplete = function() {
      resolve();
    };

    transaction.onerror = function(e) {
      reject(e.target.error);
    };
  });
}

// ==========================================
// 2. Data Synchronization & Startup
// ==========================================

async function refreshData() {
  try {
    categories = await getStoreData('categories');
    questions = await getStoreData('questions');
    
    // Sort categories alphabetically
    categories.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    
    renderAll();
  } catch (error) {
    console.error('Error refreshing data:', error);
  }
}

// ==========================================
// 3. Tab Navigation & Theme Control
// ==========================================

function switchTab(tabId) {
  activeTab = tabId;
  
  // Update nav buttons
  sidebarButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update tab contents
  tabContents.forEach(content => {
    if (content.id === `tab-${tabId}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Update headers and actions based on tabs
  const pageTitle = document.getElementById('page-title');
  const pageDesc = document.getElementById('page-desc');
  const headerActions = document.querySelector('.header-actions');

  if (tabId === 'dashboard') {
    pageTitle.textContent = 'หน้าแรก';
    pageDesc.textContent = 'ภาพรวมคลังข้อสอบและสถิติการจัดชุดข้อสอบ';
    headerActions.style.display = 'block';
  } else if (tabId === 'categories') {
    pageTitle.textContent = 'หมวดหมู่ข้อสอบ';
    pageDesc.textContent = 'จัดกลุ่มประเภทคำถาม เช่น วิทยาศาสตร์, ภาษาไทย, คณิตศาสตร์';
    headerActions.style.display = 'none';
  } else if (tabId === 'questions') {
    pageTitle.textContent = 'คลังข้อสอบ';
    pageDesc.textContent = 'จัดการคำถาม ตัวเลือก เฉลย และรูปภาพประกอบ';
    headerActions.style.display = 'block';
  } else if (tabId === 'generator') {
    pageTitle.textContent = 'จัดชุดข้อสอบ';
    pageDesc.textContent = 'สุ่มดึงข้อสอบตามจำนวนระบุ สลับตัวเลือก และพร้อมสั่งพิมพ์ A4';
    headerActions.style.display = 'none';
  } else if (tabId === 'backup') {
    pageTitle.textContent = 'สำรอง / นำเข้าข้อมูล';
    pageDesc.textContent = 'นำเข้าหรือส่งออกข้อมูลทั้งหมดเพื่อเก็บไฟล์สำรองคลังข้อสอบ';
    headerActions.style.display = 'none';
  }
}

// Theme management
function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  document.body.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  updateThemeUI(newTheme);
}

function updateThemeUI(theme) {
  if (theme === 'dark') {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
    themeText.textContent = 'โหมดสว่าง';
  } else {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
    themeText.textContent = 'โหมดมืด';
  }
}

// Setup theme on load
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.setAttribute('data-theme', savedTheme);
updateThemeUI(savedTheme);

// ==========================================
// 4. Modal & Image Handling
// ==========================================

function openQuestionModal(questionId = null) {
  editingQuestionId = questionId;
  questionForm.reset();
  currentQuestionImageBase64 = null;
  imagePreviewContainer.style.display = 'none';
  imagePreviewElement.src = '';
  
  const warningDiv = document.getElementById('duplicate-warning');
  if (warningDiv) warningDiv.style.display = 'none';
  
  // Populate category dropdown in modal
  const select = document.getElementById('question-category-select');
  select.innerHTML = '<option value="" disabled selected>-- เลือกหมวดหมู่ --</option>';
  
  if (categories.length === 0) {
    alert('กรุณาเพิ่มหมวดหมู่อย่างน้อย 1 หมวดหมู่ก่อนสร้างข้อสอบ');
    switchTab('categories');
    return;
  }

  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });

  const modalTitle = document.getElementById('modal-title');
  
  if (questionId) {
    // Edit Mode
    modalTitle.textContent = 'แก้ไขข้อสอบ';
    const q = questions.find(item => item.id === questionId);
    if (q) {
      select.value = q.categoryId;
      document.getElementById('question-text-input').value = q.questionText;
      document.getElementById('option-a-input').value = q.optionA;
      document.getElementById('option-b-input').value = q.optionB;
      document.getElementById('option-c-input').value = q.optionC;
      document.getElementById('option-d-input').value = q.optionD;
      
      // Radio choice
      const radios = document.getElementsByName('correct-option-radio');
      radios.forEach(radio => {
        if (radio.value === q.correctAnswer) {
          radio.checked = true;
        }
      });

      // Image
      if (q.image) {
        currentQuestionImageBase64 = q.image;
        imagePreviewElement.src = q.image;
        imagePreviewContainer.style.display = 'flex';
      }
    }
  } else {
    // Add Mode
    modalTitle.textContent = 'เขียนข้อสอบใหม่';
  }

  questionModal.style.display = 'flex';
}

function closeQuestionModal() {
  questionModal.style.display = 'none';
  editingQuestionId = null;
}

// Convert image file to compressed Base64
function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('กรุณาเลือกเฉพาะไฟล์รูปภาพเท่านั้น');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.src = event.target.result;
    img.onload = function() {
      // Compress image size using canvas
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert canvas to compressed jpeg
      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
      currentQuestionImageBase64 = compressedBase64;
      imagePreviewElement.src = compressedBase64;
      imagePreviewContainer.style.display = 'flex';
    };
  };
  reader.readAsDataURL(file);
}

// ==========================================
// 5. Rendering Data
// ==========================================

function renderAll() {
  renderDashboard();
  renderCategories();
  renderQuestionsList();
  renderGeneratorConfig();
}

// Render Tab 1: Dashboard
function renderDashboard() {
  document.getElementById('stat-total-questions').textContent = questions.length;
  document.getElementById('stat-total-categories').textContent = categories.length;

  const statsList = document.getElementById('category-stats-list');
  statsList.innerHTML = '';

  if (categories.length === 0) {
    statsList.innerHTML = '<p class="empty-state">ยังไม่มีข้อมูลหมวดหมู่ข้อสอบ</p>';
    return;
  }

  categories.forEach(cat => {
    const count = questions.filter(q => q.categoryId === cat.id).length;
    const percentage = questions.length > 0 ? (count / questions.length) * 100 : 0;

    const div = document.createElement('div');
    div.className = 'category-breakdown-item';
    div.innerHTML = `
      <div class="breakdown-meta">
        <span class="breakdown-title">${escapeHTML(cat.name)}</span>
        <span class="breakdown-count">${count} ข้อ (${percentage.toFixed(0)}%)</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
      </div>
    `;
    statsList.appendChild(div);
  });
}

// Render Tab 2: Categories Management
function renderCategories() {
  const tbody = document.getElementById('categories-table-body');
  tbody.innerHTML = '';

  if (categories.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center empty-state">ยังไม่มีหมวดหมู่ข้อสอบ</td>
      </tr>
    `;
    return;
  }

  categories.forEach(cat => {
    const count = questions.filter(q => q.categoryId === cat.id).length;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-bold">${escapeHTML(cat.name)}</td>
      <td class="text-center"><span class="badge">${count} ข้อ</span></td>
      <td class="text-right">
        <div class="btn-action-group">
          <button class="btn-icon btn-icon-danger" title="ลบหมวดหมู่" onclick="handleDeleteCategory(${cat.id}, ${count})">
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Tab 3: Question Bank List
function renderQuestionsList() {
  const listContainer = document.getElementById('questions-list');
  listContainer.innerHTML = '';

  // Filter & Search
  const searchQuery = searchQuestionInput.value.toLowerCase().trim();
  const filterCatVal = filterCategorySelect.value;
  
  // Populate category filter dropdown
  const filterSelect = document.getElementById('filter-category-select');
  const currentVal = filterSelect.value;
  filterSelect.innerHTML = '<option value="all">ทุกหมวดหมู่</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    filterSelect.appendChild(opt);
  });
  filterSelect.value = currentVal;

  let filtered = questions;

  if (filterCatVal !== 'all') {
    filtered = filtered.filter(q => q.categoryId === parseInt(filterCatVal));
  }

  if (searchQuery !== '') {
    filtered = filtered.filter(q => q.questionText.toLowerCase().includes(searchQuery));
  }

  // Update badge count
  document.getElementById('question-count-badge').textContent = `${filtered.length} ข้อ`;

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state-container">
        <p class="empty-state">ไม่พบข้อสอบในคลัง</p>
      </div>
    `;
    return;
  }

  // Render cards sorted by id descending (latest first)
  const sorted = [...filtered].reverse();
  sorted.forEach(q => {
    const cat = categories.find(c => c.id === q.categoryId);
    const catName = cat ? cat.name : 'ไม่มีหมวดหมู่';

    const card = document.createElement('div');
    card.className = 'question-card';
    
    let imageHTML = '';
    if (q.image) {
      imageHTML = `
        <div class="question-card-image">
          <img src="${q.image}" alt="ภาพประกอบข้อสอบ">
        </div>
      `;
    }

    card.innerHTML = `
      <div class="question-card-header">
        <span class="question-card-category">${escapeHTML(catName)}</span>
      </div>
      <p class="question-card-text">${escapeHTML(q.questionText)}</p>
      ${imageHTML}
      <div class="question-card-options">
        <div class="q-option ${q.correctAnswer === 'A' ? 'correct' : ''}"><strong>ก.</strong> ${escapeHTML(q.optionA)}</div>
        <div class="q-option ${q.correctAnswer === 'B' ? 'correct' : ''}"><strong>ข.</strong> ${escapeHTML(q.optionB)}</div>
        <div class="q-option ${q.correctAnswer === 'C' ? 'correct' : ''}"><strong>ค.</strong> ${escapeHTML(q.optionC)}</div>
        <div class="q-option ${q.correctAnswer === 'D' ? 'correct' : ''}"><strong>ง.</strong> ${escapeHTML(q.optionD)}</div>
      </div>
      <div class="question-card-footer">
        <button class="btn btn-outline btn-icon" title="แก้ไข" onclick="openQuestionModal(${q.id})">
          <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="btn btn-outline btn-icon btn-icon-danger" title="ลบ" onclick="handleDeleteQuestion(${q.id})">
          <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
    `;
    listContainer.appendChild(card);
  });
}

// Render Tab 4: Generator Configuration
function renderGeneratorConfig() {
  const container = document.getElementById('generator-categories-list');
  container.innerHTML = '';

  if (categories.length === 0) {
    container.innerHTML = '<p class="empty-state">กรุณาเพิ่มหมวดหมู่และข้อสอบก่อนจัดชุด</p>';
    return;
  }

  categories.forEach(cat => {
    const count = questions.filter(q => q.categoryId === cat.id).length;

    const row = document.createElement('div');
    row.className = 'generator-category-row';
    row.innerHTML = `
      <div class="gen-cat-meta">
        <span class="gen-cat-title">${escapeHTML(cat.name)}</span>
        <span class="gen-cat-available">มีข้อสอบในคลังทั้งหมด ${count} ข้อ</span>
      </div>
      <div class="gen-cat-input-group">
        <input type="number" class="category-gen-input" data-category-id="${cat.id}" min="0" max="${count}" value="0">
        <span>ข้อ</span>
      </div>
    `;
    container.appendChild(row);
  });
}

// ==========================================
// 6. Action Handlers (CRUD Events)
// ==========================================

// Add Category
categoryForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  const name = categoryNameInput.value.trim();
  if (!name) return;

  try {
    await addData('categories', { name });
    categoryNameInput.value = '';
    await refreshData();
  } catch (error) {
    console.error('Error adding category:', error);
  }
});

// Delete Category
async function handleDeleteCategory(id, count) {
  if (count > 0) {
    alert(`ไม่สามารถลบหมวดหมู่นี้ได้เนื่องจากมีข้อสอบค้างอยู่ในหมวดหมู่นี้ ${count} ข้อ กรุณาลบหรือเปลี่ยนหมวดหมู่ข้อสอบเหล่านั้นก่อน`);
    return;
  }

  if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่นี้?')) {
    try {
      await deleteData('categories', id);
      await refreshData();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  }
}

// Add/Update Question Form submit
questionForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const categoryId = parseInt(document.getElementById('question-category-select').value);
  const questionText = document.getElementById('question-text-input').value.trim();
  const optionA = document.getElementById('option-a-input').value.trim();
  const optionB = document.getElementById('option-b-input').value.trim();
  const optionC = document.getElementById('option-c-input').value.trim();
  const optionD = document.getElementById('option-d-input').value.trim();
  
  // Find correct answer option
  const radios = document.getElementsByName('correct-option-radio');
  let correctAnswer = null;
  radios.forEach(radio => {
    if (radio.checked) correctAnswer = radio.value;
  });

  if (!categoryId || !questionText || !optionA || !optionB || !optionC || !optionD || !correctAnswer) {
    alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    return;
  }

  // Check duplicate question
  const normalizedInput = questionText.replace(/\s+/g, ' ').trim().toLowerCase();
  const isDuplicate = questions.some(q => q.id !== editingQuestionId && q.questionText.replace(/\s+/g, ' ').trim().toLowerCase() === normalizedInput);
  if (isDuplicate) {
    const confirmSave = confirm('⚠️ โจทย์ข้อสอบนี้มีอยู่แล้วในคลังข้อสอบ คุณต้องการบันทึกข้อสอบที่ซ้ำกันนี้หรือไม่?');
    if (!confirmSave) return;
  }

  const payload = {
    categoryId,
    questionText,
    image: currentQuestionImageBase64,
    optionA,
    optionB,
    optionC,
    optionD,
    correctAnswer,
    createdAt: new Date().getTime()
  };

  try {
    if (editingQuestionId) {
      payload.id = editingQuestionId;
      await updateData('questions', payload);
    } else {
      await addData('questions', payload);
    }
    
    closeQuestionModal();
    await refreshData();
  } catch (error) {
    console.error('Error saving question:', error);
  }
});

// Delete Question
async function handleDeleteQuestion(id) {
  if (confirm('คุณแน่ใจว่าต้องการลบข้อสอบข้อนี้ออกจากคลังหรือไม่?')) {
    try {
      await deleteData('questions', id);
      await refreshData();
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  }
}

// ==========================================
// 7. Exam Generation & A4 Pagination
// ==========================================

generatorForm.addEventListener('submit', function(e) {
  e.preventDefault();

  const title = document.getElementById('exam-title-input').value.trim();
  const instructions = document.getElementById('exam-instructions-input').value.trim();
  const shuffleQuestions = document.getElementById('shuffle-questions-checkbox').checked;
  const shuffleOptions = document.getElementById('shuffle-options-checkbox').checked;

  // Retrieve requested question quantity per category
  const inputs = document.querySelectorAll('.category-gen-input');
  let selectedPool = [];
  let totalCount = 0;

  inputs.forEach(input => {
    const catId = parseInt(input.getAttribute('data-category-id'));
    const count = parseInt(input.value);
    totalCount += count;

    if (count > 0) {
      // Filter questions in this category
      const pool = questions.filter(q => q.categoryId === catId);
      
      // Shuffle the pool and slice the desired count
      const shuffledPool = shuffleArray([...pool]);
      selectedPool = selectedPool.concat(shuffledPool.slice(0, count));
    }
  });

  if (totalCount === 0) {
    alert('กรุณาระบุจำนวนข้อสอบอย่างน้อย 1 ข้อ เพื่อสร้างข้อสอบ');
    return;
  }

  // Shuffle all selected questions if enabled
  if (shuffleQuestions) {
    selectedPool = shuffleArray(selectedPool);
  }

  // Process choices and correct answers for each question
  generatedExamQuestions = selectedPool.map((q, index) => {
    const originalOptions = [
      { key: 'A', text: q.optionA, label: 'ก' },
      { key: 'B', text: q.optionB, label: 'ข' },
      { key: 'C', text: q.optionC, label: 'ค' },
      { key: 'D', text: q.optionD, label: 'ง' }
    ];

    let finalOptions = [...originalOptions];
    let finalCorrectLabel = '';

    if (shuffleOptions) {
      finalOptions = shuffleArray(finalOptions);
    }

    // Assign ก, ข, ค, ง labels based on final shuffled array position
    const thaiLabels = ['ก', 'ข', 'ค', 'ง'];
    finalOptions = finalOptions.map((opt, i) => {
      return {
        originalKey: opt.key,
        text: opt.text,
        label: thaiLabels[i]
      };
    });

    // Find the new Thai label of the correct choice
    const correctOpt = finalOptions.find(opt => opt.originalKey === q.correctAnswer);
    finalCorrectLabel = correctOpt ? correctOpt.label : '';

    return {
      id: q.id,
      num: index + 1,
      questionText: q.questionText,
      image: q.image,
      options: finalOptions,
      correctLabel: finalCorrectLabel
    };
  });

  // Open Preview Container and render initial view (Exam Sheet)
  previewExamName.textContent = title;
  printPreviewContainer.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // Lock main scrolling

  // View: Exam (Default)
  renderExamPreview(title, instructions);
});

// Helper: Shuffle Array (Fisher-Yates)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ==========================================
// 8. Pagination Rendering Algorithms
// ==========================================

// Render the Exam Sheet (Paginated A4 Pages)
function renderExamPreview(title, instructions) {
  paperViewport.innerHTML = '';
  
  // Settings
  const showName = document.getElementById('show-student-name').checked;
  const labelName = document.getElementById('label-student-name').value.trim() || 'ชื่อ-นามสกุล';

  const showClass = document.getElementById('show-student-class').checked;
  const labelClass = document.getElementById('label-student-class').value.trim() || 'เลขที่สอบ';

  const showNo = document.getElementById('show-student-no').checked;
  const labelNo = document.getElementById('label-student-no').value.trim() || 'ว่าง2';

  const showId = document.getElementById('show-student-id').checked;
  const labelId = document.getElementById('label-student-id').value.trim() || 'ว่าง3';

  // Pagination parameters
  const PAGE_HEIGHT_BUDGET = 920; // Safe height in px for 210x297mm page (minus padding)
  const HEADER_ESTIMATED_HEIGHT = 160; // Estimated height of header block on page 1
  
  let currentPageQuestions = [];
  let currentAccumulatedHeight = 0;
  const examPages = [];

  // Step 1: Divide questions into pages based on estimated rendering height
  generatedExamQuestions.forEach((q, index) => {
    const isFirstPage = examPages.length === 0;
    const pageBudget = isFirstPage ? (PAGE_HEIGHT_BUDGET - HEADER_ESTIMATED_HEIGHT) : PAGE_HEIGHT_BUDGET;

    // Estimate height of this question block
    // Text lines: assuming ~60 characters of Thai per line
    const textLines = Math.ceil(q.questionText.length / 55) || 1;
    let estimatedHeight = (textLines * 24) + 20; // base text height + margins

    // Image height
    if (q.image) {
      estimatedHeight += 180; // height of image preview box + margin
    }

    // Options height
    // Check if options are long. If any option is > 25 chars, we render single-column
    const isSingleColumn = q.options.some(opt => opt.text.length > 25);
    if (isSingleColumn) {
      estimatedHeight += 105; // 4 rows
    } else {
      estimatedHeight += 55;  // 2 rows
    }

    // Add extra padding margin
    estimatedHeight += 15;

    // If adding this question exceeds the page budget, push current page and start a new one
    if (currentAccumulatedHeight + estimatedHeight > pageBudget && currentPageQuestions.length > 0) {
      examPages.push(currentPageQuestions);
      currentPageQuestions = [q];
      currentAccumulatedHeight = estimatedHeight;
    } else {
      currentPageQuestions.push(q);
      currentAccumulatedHeight += estimatedHeight;
    }
  });

  // Push the final remaining questions
  if (currentPageQuestions.length > 0) {
    examPages.push(currentPageQuestions);
  }

  // Step 2: Render A4 Pages to DOM
  const totalPages = examPages.length;

  examPages.forEach((pageQuestions, pageIndex) => {
    const pageNum = pageIndex + 1;
    const a4Page = document.createElement('div');
    a4Page.className = 'a4-page';

    // 1. Header (Page 1 only)
    if (pageNum === 1) {
      const headerSection = document.createElement('div');
      headerSection.className = 'exam-header-section';
      
      let studentInfoHTML = '';
      if (showName || showClass || showNo || showId) {
        studentInfoHTML += '<div class="student-info-row">';
        if (showName) studentInfoHTML += `<div class="student-field"><span class="field-label">${escapeHTML(labelName)}:</span><span class="field-value" contenteditable="true">&nbsp;</span></div>`;
        if (showClass) studentInfoHTML += `<div class="student-field"><span class="field-label">${escapeHTML(labelClass)}:</span><span class="field-value" contenteditable="true">&nbsp;</span></div>`;
        if (showNo) studentInfoHTML += `<div class="student-field"><span class="field-label">${escapeHTML(labelNo)}:</span><span class="field-value" contenteditable="true">&nbsp;</span></div>`;
        if (showId) studentInfoHTML += `<div class="student-field"><span class="field-label">${escapeHTML(labelId)}:</span><span class="field-value" contenteditable="true">&nbsp;</span></div>`;
        studentInfoHTML += '</div>';
      }

      headerSection.innerHTML = `
        <div class="exam-title-display" contenteditable="true">${escapeHTML(title)}</div>
        ${studentInfoHTML}
        ${instructions ? `<div class="exam-instructions-display" contenteditable="true">${escapeHTML(instructions)}</div>` : ''}
      `;
      a4Page.appendChild(headerSection);
    }

    // 2. Questions
    const questionsContainer = document.createElement('div');
    questionsContainer.className = 'exam-questions-list';

    pageQuestions.forEach(q => {
      const qItem = document.createElement('div');
      qItem.className = 'exam-q-item';
      
      let imgHTML = '';
      if (q.image) {
        imgHTML = `<img class="exam-q-img" src="${q.image}" alt="รูปประกอบข้อ ${q.num}">`;
      }

      // Single column check
      const isSingleColumn = q.options.some(opt => opt.text.length > 25);
      const choicesClass = isSingleColumn ? 'exam-q-choices single-column' : 'exam-q-choices';

      qItem.innerHTML = `
        <div class="exam-q-text">
          <span class="q-num">${q.num}.</span>
          <span>${escapeHTML(q.questionText)}</span>
        </div>
        ${imgHTML}
        <div class="${choicesClass}">
          ${q.options.map(opt => `
            <div class="choice-item">${opt.label}. ${escapeHTML(opt.text)}</div>
          `).join('')}
        </div>
      `;
      questionsContainer.appendChild(qItem);
    });

    a4Page.appendChild(questionsContainer);

    // 3. Footer (Page numbers)
    const footer = document.createElement('div');
    footer.className = 'a4-page-footer';
    footer.textContent = `หน้า ${pageNum} จาก ${totalPages}`;
    a4Page.appendChild(footer);

    paperViewport.appendChild(a4Page);
  });
}

// Render the Answer Key (Separate Sheet - Multi-column layout to save space)
function renderAnswerKeyPreview(title) {
  paperViewport.innerHTML = '';

  const answersPool = generatedExamQuestions.map(q => {
    return {
      num: q.num,
      correctLabel: q.correctLabel
    };
  });

  // Calculate items per page (approx 80-100 items can fit on one page in 5 columns)
  const ITEMS_PER_PAGE = 80;
  const keyPages = [];
  
  for (let i = 0; i < answersPool.length; i += ITEMS_PER_PAGE) {
    keyPages.push(answersPool.slice(i, i + ITEMS_PER_PAGE));
  }

  const totalPages = keyPages.length;

  keyPages.forEach((pageAnswers, pageIndex) => {
    const pageNum = pageIndex + 1;
    const a4Page = document.createElement('div');
    a4Page.className = 'a4-page';

    // Header
    const headerSection = document.createElement('div');
    headerSection.className = 'key-header-section';
    headerSection.innerHTML = `
      <div class="key-header-title">เฉลยคำตอบข้อสอบ</div>
      <div class="key-header-subtitle">${escapeHTML(title)}</div>
    `;
    a4Page.appendChild(headerSection);

    // Answer grid (Compact layout)
    const grid = document.createElement('div');
    grid.className = 'key-compact-grid';
    
    pageAnswers.forEach(ans => {
      const item = document.createElement('div');
      item.className = 'key-compact-item';
      item.innerHTML = `
        <span class="key-num">ข้อ ${ans.num}</span>
        <span class="key-ans">${escapeHTML(ans.correctLabel)}</span>
      `;
      grid.appendChild(item);
    });

    a4Page.appendChild(grid);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'a4-page-footer';
    footer.textContent = `เฉลยคำตอบ - หน้า ${pageNum} จาก ${totalPages}`;
    a4Page.appendChild(footer);

    paperViewport.appendChild(a4Page);
  });
}

// ==========================================
// 9. Backup Import & Export Management
// ==========================================

// Trigger download of DB backup JSON file
document.getElementById('export-db-btn').addEventListener('click', async function() {
  try {
    const exportData = {
      categories: await getStoreData('categories'),
      questions: await getStoreData('questions'),
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam_bank_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล: ' + error);
  }
});

// Handle backup file select
const importDbFile = document.getElementById('import-db-file');
const importTriggerBtn = document.getElementById('import-trigger-btn');
const importFileName = document.getElementById('import-file-name');
const importDbBtn = document.getElementById('import-db-btn');

importTriggerBtn.addEventListener('click', () => importDbFile.click());

importDbFile.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    importFileName.textContent = file.name;
    importDbBtn.disabled = false;
  } else {
    importFileName.textContent = 'ไม่ได้เลือกไฟล์ใดๆ';
    importDbBtn.disabled = true;
  }
});

// Import JSON file data into database
importDbBtn.addEventListener('click', function() {
  const file = importDbFile.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(event) {
    try {
      const data = JSON.parse(event.target.result);
      
      // Validation check
      if (!data.categories || !data.questions) {
        alert('รูปแบบไฟล์สำรองไม่ถูกต้อง กรุณาเลือกไฟล์ JSON ที่ถูกส่งออกมาจากระบบนี้');
        return;
      }

      if (confirm(`คุณต้องการนำเข้าหมวดหมู่จำนวน ${data.categories.length} รายการ และข้อสอบจำนวน ${data.questions.length} รายการ หรือไม่?`)) {
        // Import categories
        for (const cat of data.categories) {
          // Check if exists, update or add
          await updateData('categories', cat);
        }

        // Import questions
        for (const q of data.questions) {
          await updateData('questions', q);
        }

        alert('นำเข้าข้อมูลเรียบร้อยแล้ว!');
        
        // Reset file inputs
        importDbFile.value = '';
        importFileName.textContent = 'ไม่ได้เลือกไฟล์ใดๆ';
        importDbBtn.disabled = true;

        await refreshData();
        switchTab('dashboard');
      }
    } catch (err) {
      alert('ไม่สามารถอ่านไฟล์ได้ รูปแบบ JSON ไม่ถูกต้อง: ' + err);
    }
  };
  reader.readAsText(file);
});

// Reset Database completely
document.getElementById('reset-db-btn').addEventListener('click', async function() {
  const code = prompt('หากต้องการลบข้อมูลทั้งหมดถาวร กรุณาพิมพ์คำว่า "RESET" เพื่อยืนยัน:');
  if (code === 'RESET') {
    try {
      await clearDatabase();
      alert('ล้างระบบข้อมูลคลังข้อสอบเรียบร้อยแล้ว');
      await refreshData();
      switchTab('dashboard');
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + err);
    }
  } else if (code !== null) {
    alert('ยืนยันรหัสไม่ถูกต้อง ยกเลิกการล้างข้อมูล');
  }
});

// ==========================================
// 10. Event Listeners Initialization
// ==========================================

// Tab Navigation
sidebarButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    switchTab(tabId);
  });
});

// Theme Toggle
themeToggleBtn.addEventListener('click', toggleTheme);

// Modals Open/Close
quickAddBtn.addEventListener('click', () => openQuestionModal());
modalCloseBtn.addEventListener('click', closeQuestionModal);
modalCancelBtn.addEventListener('click', closeQuestionModal);

// Close modal when clicking outside contents
window.addEventListener('click', (e) => {
  if (e.target === questionModal) {
    closeQuestionModal();
  }
});

// Image Upload triggers
imageUploadTrigger.addEventListener('click', () => questionImageInput.click());
questionImageInput.addEventListener('change', handleImageUpload);
removeImageBtn.addEventListener('click', () => {
  currentQuestionImageBase64 = null;
  questionImageInput.value = '';
  imagePreviewContainer.style.display = 'none';
  imagePreviewElement.src = '';
});

// Print Preview Navigation & Trigger
backToGenBtn.addEventListener('click', () => {
  printPreviewContainer.style.display = 'none';
  document.body.style.overflow = 'auto'; // Restore scrolling
});

toggleViewExamBtn.addEventListener('click', () => {
  toggleViewExamBtn.classList.add('active');
  toggleViewKeyBtn.classList.remove('active');
  const title = document.getElementById('exam-title-input').value.trim();
  const instructions = document.getElementById('exam-instructions-input').value.trim();
  renderExamPreview(title, instructions);
});

toggleViewKeyBtn.addEventListener('click', () => {
  toggleViewExamBtn.classList.remove('active');
  toggleViewKeyBtn.classList.add('active');
  const title = document.getElementById('exam-title-input').value.trim();
  renderAnswerKeyPreview(title);
});

printExamBtn.addEventListener('click', () => {
  window.print();
});

// Filters inputs events
searchQuestionInput.addEventListener('input', renderQuestionsList);
filterCategorySelect.addEventListener('change', renderQuestionsList);

// Real-time duplicate check event listener
const questionTextInput = document.getElementById('question-text-input');
if (questionTextInput) {
  questionTextInput.addEventListener('input', checkDuplicateQuestion);
}

// Function to check if a question is a duplicate in real-time
function checkDuplicateQuestion() {
  const textInput = document.getElementById('question-text-input');
  const warningDiv = document.getElementById('duplicate-warning');
  const warningCatSpan = document.getElementById('duplicate-warning-cat');
  
  if (!textInput || !warningDiv) return;

  const rawText = textInput.value;
  const normalizedText = rawText.replace(/\s+/g, ' ').trim().toLowerCase();
  
  if (normalizedText === '') {
    warningDiv.style.display = 'none';
    return;
  }

  // Check if there is an existing question with the same normalized text
  const match = questions.find(q => {
    if (editingQuestionId && q.id === editingQuestionId) {
      return false;
    }
    const qNormalized = q.questionText.replace(/\s+/g, ' ').trim().toLowerCase();
    return qNormalized === normalizedText;
  });

  if (match) {
    const cat = categories.find(c => c.id === match.categoryId);
    const catName = cat ? cat.name : 'ไม่มีหมวดหมู่';
    warningCatSpan.textContent = catName;
    warningDiv.style.display = 'block';
  } else {
    warningDiv.style.display = 'none';
  }
}

// Helper: Escape HTML strings to prevent XSS issues
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Bind global functions to window object for HTML inline onclick access
window.openQuestionModal = openQuestionModal;
window.handleDeleteQuestion = handleDeleteQuestion;
window.handleDeleteCategory = handleDeleteCategory;

// Startup Init sequence
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await initDB();
    await refreshData();
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
