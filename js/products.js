import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js";
import { db, storage } from './firebase.js';
import { showToast, showLoading, hideLoading, formatPrice, truncateText, getStarRating } from './utils.js';
import { addToCart } from './cart.js';

let lastVisible = null;
let currentFilter = 'all';

export async function loadProducts(filter = 'all', searchQuery = '', category = '') {
  try {
    showLoading();
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    productsGrid.innerHTML = '<div class="skeleton" style="height: 300px; grid-column: 1/-1;"></div>'.repeat(4);
    
    let q = collection(db, 'products');
    const conditions = [];
    
    if (filter !== 'all') {
      conditions.push(where('productType', '==', filter));
    }
    
    if (category) {
      conditions.push(where('category', '==', category));
    }
    
    if (conditions.length > 0) {
      q = query(q, ...conditions, orderBy('createdAt', 'desc'), limit(12));
    } else {
      q = query(q, orderBy('createdAt', 'desc'), limit(12));
    }
    
    const snapshot = await getDocs(q);
    lastVisible = snapshot.docs[snapshot.docs.length - 1];
    
    const products = [];
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    
    // Filter by search query client-side
    let filteredProducts = products;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      );
    }
    
    renderProducts(filteredProducts, productsGrid);
    
  } catch (error) {
    console.error('Error loading products:', error);
    showToast('Failed to load products', 'error');
  } finally {
    hideLoading();
  }
}

export function renderProducts(products, container) {
  if (!container) return;
  
  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">📦</div>
        <h3>No products found</h3>
        <p>Try adjusting your filters or search query</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = products.map(product => `
    <div class="product-card" data-id="${product.id}">
      ${product.discount > 0 ? `<span class="product-badge">-${product.discount}%</span>` : ''}
      ${product.productType === 'digital' ? `<span class="product-badge digital">DIGITAL</span>` : ''}
      <div class="product-image">
        <img src="${product.images?.[0] || '/assets/images/placeholder.jpg'}" alt="${product.name}" loading="lazy">
        <div class="product-actions">
          <button class="action-btn view-btn" onclick="window.location.href='product.html?id=${product.id}'" title="View">
            👁️
          </button>
          <button class="action-btn cart-btn" onclick="addToCart('${product.id}')" title="Add to Cart">
            🛒
          </button>
        </div>
      </div>
      <div class="product-info">
        <div class="product-category">${product.category}</div>
        <h3 class="product-name">${truncateText(product.name, 50)}</h3>
        <div class="product-price">
          <span class="current-price">${formatPrice(product.finalPrice || product.price)}</span>
          ${product.discount > 0 ? `
            <span class="original-price">${formatPrice(product.price)}</span>
            <span class="discount-badge">-${product.discount}%</span>
          ` : ''}
        </div>
        <div class="product-rating">
          <span class="stars">${getStarRating(product.rating || 4.5)}</span>
          <span>(${product.reviews || 0})</span>
        </div>
      </div>
    </div>
  `).join('');
}

export async function loadProductDetails(productId) {
  try {
    showLoading();
    
    const docRef = doc(db, 'products', productId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      showToast('Product not found', 'error');
      window.location.href = 'index.html';
      return null;
    }
    
    const product = { id: docSnap.id, ...docSnap.data() };
    renderProductDetails(product);
    return product;
    
  } catch (error) {
    console.error('Error loading product:', error);
    showToast('Failed to load product details', 'error');
    return null;
  } finally {
    hideLoading();
  }
}

function renderProductDetails(product) {
  const container = document.getElementById('productDetails');
  if (!container) return;
  
  container.innerHTML = `
    <div class="product-gallery">
      <div class="main-image">
        <img src="${product.images?.[0] || '/assets/images/placeholder.jpg'}" id="mainImage" alt="${product.name}">
      </div>
      ${product.images?.length > 1 ? `
        <div class="thumbnail-list">
          ${product.images.map((img, i) => `
            <img src="${img}" class="thumbnail ${i === 0 ? 'active' : ''}" onclick="changeImage('${img}', this)" alt="">
          `).join('')}
        </div>
      ` : ''}
    </div>
    
    <div class="product-info-detail">
      <div class="product-header">
        <span class="product-category-badge">${product.category}</span>
        ${product.productType === 'digital' ? '<span class="product-type-badge">Digital Download</span>' : ''}
      </div>
      
      <h1>${product.name}</h1>
      
      <div class="product-rating-large">
        <span class="stars">${getStarRating(product.rating || 4.5)}</span>
        <span class="rating-count">${product.reviews || 0} reviews</span>
      </div>
      
      <div class="product-price-large">
        <span class="current-price">${formatPrice(product.finalPrice || product.price)}</span>
        ${product.discount > 0 ? `
          <span class="original-price">${formatPrice(product.price)}</span>
          <span class="discount-badge-large">Save ${product.discount}%</span>
        ` : ''}
      </div>
      
      <div class="product-description">
        <h3>Description</h3>
        <p>${product.description}</p>
      </div>
      
      ${product.productType === 'physical' ? `
        <div class="product-stock">
          <span class="stock-status ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}">
            ${product.stock > 0 ? `✓ In Stock (${product.stock} available)` : '✗ Out of Stock'}
          </span>
        </div>
      ` : ''}
      
      <div class="product-actions-detail">
        <div class="quantity-selector">
          <button class="qty-btn" onclick="updateQty(-1)">-</button>
          <input type="number" id="qty" value="1" min="1" max="${product.stock || 99}" readonly>
          <button class="qty-btn" onclick="updateQty(1)">+</button>
        </div>
        <button class="btn btn-primary btn-lg add-to-cart-btn" onclick="addToCart('${product.id}', parseInt(document.getElementById('qty').value))">
          🛒 Add to Cart
        </button>
      </div>
      
      <div class="product-meta">
        <div class="meta-item">
          <span class="meta-label">Type:</span>
          <span class="meta-value">${product.productType === 'digital' ? 'Digital Download' : 'Physical Product'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">SKU:</span>
          <span class="meta-value">${product.id.substring(0, 8).toUpperCase()}</span>
        </div>
      </div>
    </div>
  `;
  
  // Add styles for product detail
  const style = document.createElement('style');
  style.textContent = `
    .product-detail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 50px;
      padding: 40px 0;
    }
    
    .product-gallery {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .main-image {
      background: var(--gray-light);
      border-radius: var(--radius-lg);
      overflow: hidden;
      aspect-ratio: 1;
    }
    
    .main-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .thumbnail-list {
      display: flex;
      gap: 10px;
    }
    
    .thumbnail {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: var(--radius);
      cursor: pointer;
      border: 2px solid transparent;
      transition: var(--transition);
    }
    
    .thumbnail.active,
    .thumbnail:hover {
      border-color: var(--primary);
    }
    
    .product-info-detail h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 15px;
      color: var(--dark);
    }
    
    .product-header {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }
    
    .product-category-badge {
      background: var(--gray-light);
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--gray);
    }
    
    .product-type-badge {
      background: var(--info);
      color: white;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .product-rating-large {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .stars {
      color: var(--warning);
      font-size: 20px;
    }
    
    .rating-count {
      color: var(--gray);
    }
    
    .product-price-large {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 25px;
    }
    
    .product-price-large .current-price {
      font-size: 36px;
      font-weight: 700;
      color: var(--primary);
    }
    
    .original-price {
      font-size: 20px;
      color: var(--gray);
      text-decoration: line-through;
    }
    
    .discount-badge-large {
      background: var(--success);
      color: white;
      padding: 8px 16px;
      border-radius: var(--radius);
      font-weight: 600;
    }
    
    .product-description {
      margin-bottom: 25px;
    }
    
    .product-description h3 {
      font-size: 18px;
      margin-bottom: 10px;
      color: var(--dark);
    }
    
    .product-description p {
      color: var(--gray);
      line-height: 1.8;
    }
    
    .product-stock {
      margin-bottom: 25px;
    }
    
    .stock-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: var(--radius);
      font-weight: 500;
    }
    
    .stock-status.in-stock {
      background: rgba(40, 167, 69, 0.1);
      color: var(--success);
    }
    
    .stock-status.out-of-stock {
      background: rgba(220, 53, 69, 0.1);
      color: var(--danger);
    }
    
    .product-actions-detail {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .quantity-selector {
      display: flex;
      align-items: center;
      border: 2px solid var(--gray-light);
      border-radius: var(--radius);
      overflow: hidden;
    }
    
    .quantity-selector input {
      width: 60px;
      text-align: center;
      border: none;
      font-weight: 600;
      font-size: 16px;
      color: var(--dark);
      background: var(--white);
    }
    
    .product-meta {
      border-top: 1px solid var(--gray-light);
      padding-top: 25px;
    }
    
    .meta-item {
      display: flex;
      margin-bottom: 10px;
      font-size: 14px;
    }
    
    .meta-label {
      color: var(--gray);
      width: 100px;
    }
    
    .meta-value {
      color: var(--dark);
      font-weight: 500;
    }
    
    @media (max-width: 968px) {
      .product-detail {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

export async function loadCategories() {
  try {
    const snapshot = await getDocs(collection(db, 'categories'));
    const categories = [];
    snapshot.forEach(doc => {
      categories.push({ id: doc.id, ...doc.data() });
    });
    return categories;
  } catch (error) {
    console.error('Error loading categories:', error);
    return [];
  }
}

export function renderCategories(categories, container) {
  if (!container) return;
  
  container.innerHTML = categories.map(cat => `
    <a href="index.html?category=${cat.name}" class="category-card">
      <div class="category-icon">${cat.icon || '📦'}</div>
      <div class="category-name">${cat.name}</div>
    </a>
  `).join('');
}

export async function searchProducts(query) {
  try {
    const q = query(collection(db, 'products'), orderBy('name'), limit(50));
    const snapshot = await getDocs(q);
    const products = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.name.toLowerCase().includes(query.toLowerCase())) {
        products.push({ id: doc.id, ...data });
      }
    });
    return products;
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}

// Global functions for onclick handlers
window.changeImage = function(src, thumb) {
  document.getElementById('mainImage').src = src;
  document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
};

window.updateQty = function(change) {
  const input = document.getElementById('qty');
  const newVal = parseInt(input.value) + change;
  const max = parseInt(input.max) || 99;
  if (newVal >= 1 && newVal <= max) {
    input.value = newVal;
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      loadProducts(currentFilter);
    });
  });
  
  // Search
  const searchForm = document.getElementById('searchForm');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = document.getElementById('searchInput').value;
      loadProducts('all', query);
    });
  }
  
  // Load initial products
  if (document.getElementById('productsGrid')) {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category') || '';
    loadProducts('all', '', category);
  }
  
  // Load product details
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');
  if (productId && document.getElementById('productDetails')) {
    loadProductDetails(productId);
  }
});
