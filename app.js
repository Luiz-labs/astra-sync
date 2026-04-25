// ==========================
// SUPABASE CONFIG
// ==========================
const SUPABASE_URL = 'https://smjutrdpzqqjcqcdwdra.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sNeHAe2K-grXWfJ-g1Uf8w_rEtluc6T';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================
// STORAGE LOCAL
// ==========================
const STORAGE_KEYS = {
    products: 'astra_products',
    sales: 'astra_sales',
    customers: 'astra_customers'
};

// --- AUTH LOGIC ---
function canHardDeleteSales() {
    const email = window.currentUserEmail || '';
    return email.toLowerCase().includes('luis.lecaros.d');
}

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isLoggedIn = !!session;
    window.currentUserEmail = session?.user?.email || '';
    const loginView = document.getElementById('loginView');
    const mainAppUI = document.getElementById('mainAppUI');

    if (isLoggedIn) {
        if (loginView) loginView.style.display = 'none';
        if (mainAppUI) mainAppUI.removeAttribute('hidden');
    } else {
        if (loginView) loginView.style.display = 'flex';
        if (mainAppUI) mainAppUI.setAttribute('hidden', '');
    }
}

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value.trim();

    if (!email || !password) {
        showToast('Ingresa tu correo y contraseña.', '❌');
        return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    console.log('DEBUG login data:', data);
    console.log('DEBUG login error:', error);

    if (error) {
        showToast('No se pudo iniciar sesión. Verifica tus credenciales.', '❌');
        return;
    }

    showToast('Sesión iniciada correctamente.', '✅');
    await checkAuth();
    navigateTo('dashboardView');
});

document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('astra_logged_in'); // Por limpieza
    await checkAuth();
    const form = document.getElementById('loginForm');
    if (form) form.reset();
});

// --- UI FEEDBACK ---
function showToast(message, icon = '✅') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirm(title, text, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) { onConfirm(); return; }
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalText').textContent = text;

    const btnCancel = document.getElementById('btnConfirmCancel');
    const btnOk = document.getElementById('btnConfirmOk');

    const newBtnCancel = btnCancel.cloneNode(true);
    const newBtnOk = btnOk.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);

    newBtnCancel.addEventListener('click', () => modal.close());
    newBtnOk.addEventListener('click', () => {
        modal.close();
        onConfirm();
    });

    modal.showModal();
}

// --- DATA HELPERS ---
function getData(key) {
    return JSON.parse(localStorage.getItem(key)) || [];
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

async function getCurrentProfile() {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

    console.log('DEBUG sessionData:', sessionData);
    console.log('DEBUG sessionError:', sessionError);

    if (sessionError) {
        console.error('Error obteniendo sesión:', sessionError);
        throw new Error('No se pudo obtener la sesión del usuario.');
    }

    const user = sessionData?.session?.user;
    console.log('DEBUG user:', user);

    if (!user) {
        throw new Error('No se encontró una sesión activa.');
    }

    const { data, error } = await supabaseClient.rpc('get_my_profile');

    console.log('DEBUG rpc data:', data);
    console.log('DEBUG rpc error:', error);

    if (error) {
        console.error('Error RPC get_my_profile:', error);
        throw new Error('No se pudo obtener el perfil del usuario.');
    }

    const profile = Array.isArray(data) ? data[0] : data;
    console.log('DEBUG profile final:', profile);

    if (!profile) {
        throw new Error('No existe un perfil asociado al usuario actual.');
    }

    return profile;
}

async function fetchProductsFromSupabase() {
    const profile = await getCurrentProfile();

    const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

async function fetchCustomersFromSupabase() {
    const profile = await getCurrentProfile();
    const { data, error } = await supabaseClient
        .from('customers')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function fetchSalesFromSupabase() {
    const profile = await getCurrentProfile();
    const { data, error } = await supabaseClient
        .from('sales')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

// --- NAVEGACION ---
const navButtons = document.querySelectorAll('#mainNav button');
const views = document.querySelectorAll('main > section');

function navigateTo(targetId) {
    views.forEach(view => {
        if (view.id === targetId) {
            view.removeAttribute('hidden');
        } else {
            view.setAttribute('hidden', '');
        }
    });

    navButtons.forEach(btn => {
        if (btn.dataset.target === targetId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Refresh view specific data
    if (targetId === 'dashboardView') updateDashboard();
    if (targetId === 'productsView') renderProducts();
    if (targetId === 'customersView') renderCustomers();
    if (targetId === 'salesView') loadSalesForm();
    if (targetId === 'salesHistoryView') renderSalesHistory();
    if (targetId === 'paymentsView') renderPaymentsView();
    if (targetId === 'reportsView') updateReports();
}

navButtons.forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.target));
});



// Logo Preview
document.getElementById('logoUploadInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (evt) {
            document.getElementById('logoPreviewPlaceholder').src = evt.target.result;
            document.getElementById('activeAppLogo').src = evt.target.result;
        };
        reader.readAsDataURL(file);
    }
});


// --- PRODUCTOS CRUD ---
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const productCostInput = document.getElementById('productCost');
const productSalePriceInput = document.getElementById('productSalePrice');
const marginPreviewAmount = document.getElementById('marginPreviewAmount');

document.getElementById('btnShowAddProduct')?.addEventListener('click', () => {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productModalTitle').textContent = 'Añadir Producto';
    document.getElementById('marginPreviewAmount').textContent = '0%';
    productModal.showModal();
});

document.getElementById('btnCloseProductModal')?.addEventListener('click', () => productModal.close());

function calculateMarginPreview() {
    const cost = parseFloat(productCostInput.value) || 0;
    const price = parseFloat(productSalePriceInput.value) || 0;
    if (price > 0 && price >= cost) {
        const margin = ((price - cost) / price) * 100;
        marginPreviewAmount.textContent = margin.toFixed(1) + '%';
        marginPreviewAmount.style.color = 'var(--success-green)';
    } else if (price > 0 && cost > price) {
        const margin = ((price - cost) / price) * 100;
        marginPreviewAmount.textContent = margin.toFixed(1) + '%';
        marginPreviewAmount.style.color = 'var(--danger-red)';
    } else {
        marginPreviewAmount.textContent = '0%';
        marginPreviewAmount.style.color = 'var(--accent-blue)';
    }
}

productCostInput.addEventListener('input', calculateMarginPreview);
productSalePriceInput.addEventListener('input', calculateMarginPreview);

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('productId').value;

    const rawCost = parseFloat(productCostInput.value);
    const rawPrice = parseFloat(productSalePriceInput.value);
    const rawStock = parseInt(document.getElementById('productStock').value);
    const rawName = document.getElementById('productName').value.trim();

    if (!rawName) {
        showToast('El nombre del producto es obligatorio.', '❌');
        return;
    }

    if (rawCost < 0 || rawPrice < 0 || rawStock < 0) {
        showToast('Costo, precio y stock no pueden tener valores negativos.', '❌');
        return;
    }

    let rawCategory = document.getElementById('productCategory').value.trim();
    if (rawCategory === '') rawCategory = 'General';

    const rawSupplier = document.getElementById('productSupplier').value.trim();

    let profile;
    try {
        profile = await getCurrentProfile();
    } catch (error) {
        console.error(error);
        showToast('No se pudo obtener el perfil del usuario.', '❌');
        return;
    }

    const productPayload = {
        tenant_id: profile.tenant_id,
        name: rawName,
        category: rawCategory,
        supplier: rawSupplier,
        cost: rawCost,
        sale_price: rawPrice,
        stock: rawStock,
        created_by: profile.id
    };

    const saveAction = async () => {
        let error;

        if (idInput) {
            const result = await supabaseClient
                .from('products')
                .update({
                    name: productPayload.name,
                    category: productPayload.category,
                    supplier: productPayload.supplier,
                    cost: productPayload.cost,
                    sale_price: productPayload.sale_price,
                    stock: productPayload.stock
                })
                .eq('id', idInput);

            error = result.error;
        } else {
            const result = await supabaseClient
                .from('products')
                .insert(productPayload);

            error = result.error;
        }

        if (error) {
            console.error(error);
            showToast('No se pudo guardar el producto.', '❌');
            return;
        }

        productModal.close();
        showToast('Producto guardado correctamente.');
        await renderProducts();
    };

    if (rawPrice < rawCost) {
        showConfirm(
            'Precio bajo costo',
            'Atención: El precio de venta es menor al costo. ¿Deseas guardar de todos modos?',
            saveAction
        );
    } else {
        await saveAction();
    }
});

// EXCEL IMPORT LOGIC
document.getElementById('btnImportExcel')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('excelFileInput');

    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('Por favor selecciona un archivo Excel (.xlsx o .xls) primero.', '❌');
        return;
    }

    let profile;
    try {
        profile = await getCurrentProfile();
    } catch (error) {
        console.error(error);
        showToast('No se pudo obtener el perfil del usuario.', '❌');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // Detectar fila de cabeceras dinámicamente
            const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
            let headerRowIndex = -1;

            const normalizeHeader = (value) => {
                return String(value || '')
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            };

            for (let i = 0; i < matrix.length; i++) {
                const row = matrix[i];
                if (!row || !Array.isArray(row)) continue;

                const normalizedCells = row
                    .map(normalizeHeader)
                    .filter(Boolean);

                const hasNombre = normalizedCells.includes('nombre') || normalizedCells.includes('producto') || normalizedCells.includes('articulo');
                const hasCosto = normalizedCells.includes('costo') || normalizedCells.includes('cost');
                const hasPrecio = normalizedCells.includes('precio_venta') || normalizedCells.includes('precio venta') || normalizedCells.includes('precio');
                const hasStock = normalizedCells.includes('stock') || normalizedCells.includes('cantidad') || normalizedCells.includes('inventario');

                const validHeaderCount = [hasNombre, hasCosto, hasPrecio, hasStock].filter(Boolean).length;

                if (validHeaderCount >= 3) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex === -1) {
                showToast('No se encontraron cabeceras válidas en el Excel.', '❌');
                return;
            }

            const json = XLSX.utils.sheet_to_json(worksheet, {
                range: headerRowIndex,
                raw: false
            });

            let imported = 0;
            let skipped = 0;
            const rowsToInsert = [];

            json.forEach(row => {
                const getKey = (keys) => {
                    const found = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()));
                    return found ? row[found] : null;
                };

                const rawName = getKey(['nombre', 'producto', 'name', 'articulo']);

                if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') {
                    skipped++;
                    return;
                }

                let rawCost = parseFloat(getKey(['costo', 'cost', 'precio compra', 'precio_compra']));
                let rawPrice = parseFloat(getKey(['precio_venta', 'precio venta', 'precio', 'price', 'venta']));
                let rawStock = parseInt(getKey(['stock', 'cantidad', 'inventario', 'qty']));

                if (isNaN(rawCost)) rawCost = 0;
                if (isNaN(rawPrice)) rawPrice = 0;
                if (isNaN(rawStock)) rawStock = 0;

                rowsToInsert.push({
                    tenant_id: profile.tenant_id,
                    name: rawName.trim(),
                    category: String(getKey(['categoría', 'categoria', 'category']) || 'General').trim() || 'General',
                    supplier: String(getKey(['proveedor', 'supplier', 'marca']) || '').trim(),
                    cost: rawCost,
                    sale_price: rawPrice,
                    stock: rawStock,
                    created_by: profile.id
                });

                imported++;
            });

            if (rowsToInsert.length === 0) {
                showToast('No se encontraron filas válidas para importar.', '❌');
                return;
            }

            const { error } = await supabaseClient
                .from('products')
                .upsert(rowsToInsert, { onConflict: 'tenant_id, name' });

            if (error) {
                console.error(error);
                showToast('Ocurrió un error al importar productos.', '❌');
                return;
            }

            showToast(`Importados: ${imported} | Omitidos: ${skipped}`);
            fileInput.value = '';
            await renderProducts();
        } catch (error) {
            console.error(error);
            showToast('No se pudo procesar el archivo Excel.', '❌');
        }
    };

    reader.readAsArrayBuffer(file);
});

window.editProduct = async function (id) {
    try {
        const { data: product, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !product) {
            showToast('No se pudo cargar el producto.', '❌');
            return;
        }

        document.getElementById('productModalTitle').textContent = 'Editar Producto';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('productSupplier').value = product.supplier || '';
        document.getElementById('productCost').value = product.cost;
        document.getElementById('productSalePrice').value = product.sale_price;
        document.getElementById('productStock').value = product.stock;

        calculateMarginPreview();
        productModal.showModal();
    } catch (error) {
        console.error(error);
        showToast('No se pudo cargar el producto.', '❌');
    }
};

window.deleteProduct = function (id) {
    showConfirm('Eliminar Producto', '¿Estás seguro de que deseas eliminar este producto?', async () => {
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            console.error(error);
            showToast('No se pudo eliminar el producto.', '❌');
            return;
        }

        showToast('Producto eliminado', '🗑️');
        await renderProducts();
    });
};

async function renderProducts(searchQuery = '') {
    const tbody = document.getElementById('productsTableBody');

    let products = [];

    try {
        products = await fetchProductsFromSupabase();
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <div class="empty-text">No se pudieron cargar los productos.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Agrupar por nombre para evitar duplicados visuales
    const uniqueMap = new Map();

    products.forEach(p => {
        const key = (p.name || '').toLowerCase();

        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, { ...p });
        } else {
            // Consolidar stock si hay duplicados
            const existing = uniqueMap.get(key);
            existing.stock += p.stock;
        }
    });

    const uniqueProducts = Array.from(uniqueMap.values());

    // Poblar chips de categorías
    const chipsContainer = document.getElementById('productCategoryChips');
    if (typeof window.selectedProductCategory === 'undefined') {
        window.selectedProductCategory = '';
    }
    
    if (chipsContainer && uniqueProducts.length > 0) {
        const categories = ['Todas', ...new Set(uniqueProducts.map(p => p.category || 'General'))].sort((a, b) => {
            if (a === 'Todas') return -1;
            if (b === 'Todas') return 1;
            return a.localeCompare(b);
        });
        
        chipsContainer.innerHTML = '';
        categories.forEach(cat => {
            const chip = document.createElement('button');
            chip.className = 'product-category-chip';
            if ((cat === 'Todas' && window.selectedProductCategory === '') || cat === window.selectedProductCategory) {
                chip.classList.add('active');
            }
            chip.textContent = cat;
            chip.onclick = () => {
                window.selectedProductCategory = cat === 'Todas' ? '' : cat;
                renderProducts(document.getElementById('searchProducts')?.value.trim() || '');
            };
            chipsContainer.appendChild(chip);
        });
    }

    // Aplicar búsqueda sobre lista limpia
    const term = String(searchQuery || '').toLowerCase().trim();
    const termNoDash = term.replace(/-/g, '');

    const filtered = uniqueProducts.filter(p => {
        const name = String(p.name || '').toLowerCase();
        const code = String(p.product_code || '').toLowerCase();
        const codeNoDash = code.replace(/-/g, '');
        const cat = p.category || 'General';

        const matchesSearch = (
            !term ||
            name.includes(term) ||
            code.includes(term) ||
            codeNoDash.includes(termNoDash) ||
            `${code} ${name}`.includes(term)
        );
        
        const matchesCategory = !window.selectedProductCategory || cat === window.selectedProductCategory;

        return matchesSearch && matchesCategory;
    });

    // Limpiar el contenedor justo antes de pintar para evitar duplicados por asincronía
    tbody.innerHTML = '';

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-icon">📦</div>
                        <div class="empty-text">
                            ${searchQuery ? 'No se encontraron productos en la búsqueda.' : 'Aún no hay productos registrados.'}
                        </div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(p => {
        const margin = p.sale_price > 0
            ? (((p.sale_price - p.cost) / p.sale_price) * 100).toFixed(1)
            : 0;

        const proveedorVisual = p.supplier
            ? ` · Proveedor: ${p.supplier}`
            : '';

        let stockBadge = '';
        if (p.stock === 0) {
            stockBadge = '<span class="badge badge-danger">Sin stock</span>';
        } else if (p.stock <= 3) {
            stockBadge = '<span class="badge badge-warning">Bajo stock</span>';
        } else {
            stockBadge = '<span class="badge badge-success">Disponible</span>';
        }

        const createdAt = p.created_at ? new Date(p.created_at).toLocaleDateString() : '-';

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                viewProductHistory(p.id, p);
            }
        };
        tr.innerHTML = `
            <td>
                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 2px;">${p.product_code || ''}</div>
                <div style="font-weight: bold; font-size: 15px; margin-bottom: 4px;">${p.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Categoría: ${p.category || 'General'}${proveedorVisual}</div>
            </td>
            <td>
                <div style="font-weight: bold; font-size: 15px; margin-bottom: 4px;">S/ ${Number(p.sale_price).toFixed(2)}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Costo: S/ ${Number(p.cost).toFixed(2)}</div>
            </td>
            <td>
                <span style="font-weight: bold; font-size: 15px;">${p.stock}</span>
            </td>
            <td>
                ${stockBadge}
            </td>
            <td>
                <button onclick="event.stopPropagation(); editProduct('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--accent-blue);font-size:16px;">✏️</button>
                <button onclick="event.stopPropagation(); deleteProduct('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--danger-red);font-size:16px;margin-left:8px;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.viewProductHistory = async function (productId, product) {
    document.getElementById('productDetailInfo').innerHTML = `
        <div><strong>Nombre:</strong> ${product.product_code || ''} — ${product.name}</div>
        <div><strong>Categoría:</strong> ${product.category || '-'}</div>
        <div><strong>Stock:</strong> ${product.stock}</div>
        <div><strong>Precio:</strong> S/ ${Number(product.sale_price).toFixed(2)}</div>
    `;
    const tbody = document.getElementById('productHistoryTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';
    document.getElementById('productHistoryModal').showModal();

    try {
        const { data: sales } = await supabaseClient
            .from('sales')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        tbody.innerHTML = '';
        if (!sales || sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay ventas registradas.</td></tr>';
            return;
        }

        sales.forEach(s => {
            const d = new Date(s.created_at).toLocaleDateString();
            const estado = s.is_voided ? '<span style="color:var(--danger-red);font-size:12px;font-weight:bold;">Anulada</span>' : '<span style="color:var(--success-green);font-size:12px;font-weight:bold;">Activa</span>';
            const tr = document.createElement('tr');
            if (s.is_voided) tr.style.opacity = '0.6';
            tr.innerHTML = `
                <td>${d}</td>
                <td>${s.customer_name_snapshot || 'Mostrador'}</td>
                <td>${s.quantity}</td>
                <td>S/ ${Number(s.total).toFixed(2)}</td>
                <td>${estado}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Error al cargar historial.</td></tr>';
    }
};
document.getElementById('btnCloseProductHistoryModal')?.addEventListener('click', () => document.getElementById('productHistoryModal').close());

let searchProductsTimeout;
document.getElementById('searchProducts')?.addEventListener('input', (e) => {
    clearTimeout(searchProductsTimeout);
    searchProductsTimeout = setTimeout(() => {
        renderProducts(e.target.value.trim());
    }, 300);
});




// --- CLIENTES CRUD ---
const customerModal = document.getElementById('customerModal');
const customerForm = document.getElementById('customerForm');

document.getElementById('btnShowAddCustomer').addEventListener('click', () => {
    customerForm.reset();
    document.getElementById('customerId').value = '';
    document.getElementById('customerModalTitle').textContent = 'Añadir Cliente';
    customerModal.showModal();
});

document.getElementById('btnCloseCustomerModal').addEventListener('click', () => customerModal.close());

customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('customerId').value;
    const name = document.getElementById('customerName').value;
    const phone = document.getElementById('customerPhone').value;
    const email = document.getElementById('customerEmail').value;
    const address = document.getElementById('customerAddress').value;
    const district = document.getElementById('customerDistrict').value;

    let profile;
    try {
        profile = await getCurrentProfile();
    } catch (error) {
        showToast('Error de usuario', '❌');
        return;
    }

    const payload = { tenant_id: profile.tenant_id, name, phone, email, address, district };
    let error;

    if (idInput) {
        const res = await supabaseClient.from('customers').update({ name, phone, email, address, district }).eq('id', idInput);
        error = res.error;
    } else {
        const res = await supabaseClient.from('customers').insert(payload);
        error = res.error;
    }

    if (error) {
        showToast('Error al guardar cliente', '❌');
        return;
    }

    customerModal.close();
    showToast('Cliente guardado');
    await renderCustomers();
});

window.editCustomer = async function (id) {
    const { data: c } = await supabaseClient.from('customers').select('*').eq('id', id).single();
    if (!c) return;

    document.getElementById('customerId').value = c.id;
    document.getElementById('customerName').value = c.name;
    document.getElementById('customerPhone').value = c.phone || '';
    document.getElementById('customerEmail').value = c.email || '';
    document.getElementById('customerAddress').value = c.address || '';
    document.getElementById('customerDistrict').value = c.district || '';
    document.getElementById('customerModalTitle').textContent = 'Editar Cliente';

    customerModal.showModal();
};

window.deleteCustomer = function (id) {
    showConfirm('Eliminar Cliente', '¿Estás seguro de que deseas eliminar este cliente?', async () => {
        const { error } = await supabaseClient.from('customers').delete().eq('id', id);
        if (error) {
            showToast('No se eliminó', '❌');
            return;
        }
        showToast('Cliente eliminado', '🗑️');
        await renderCustomers();
    });
};

async function renderCustomers() {
    const tbody = document.getElementById('customersTableBody');
    tbody.innerHTML = '';
    let customers = [];
    try { customers = await fetchCustomersFromSupabase(); } catch (e) { }

    if (customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
            <div class="empty-icon">👥</div>
            <div class="empty-text">Todavía no hay clientes guardados.</div>
        </div></td></tr>`;
        return;
    }

    customers.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.name}</td>
            <td>${c.phone || '-'}</td>
            <td>${c.email || '-'}</td>
            <td>${c.address || '-'}</td>
            <td>${c.district || '-'}</td>
            <td style="display: flex; gap: 8px;">
                <button onclick="editCustomer('${c.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 13px;">Editar</button>
                <button onclick="viewCustomerHistory('${c.id}', '${c.name.replace(/'/g, "\\'")}')" class="btn-secondary" style="padding: 6px 12px; font-size: 13px;">Historial</button>
                <button onclick="deleteCustomer('${c.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 13px; color: var(--danger-red); border-color: rgba(255, 69, 58, 0.2);">X</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.viewCustomerHistory = async function (customerId, customerName) {
    document.getElementById('customerHistoryName').textContent = customerName;
    const tbody = document.getElementById('customerHistoryTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';
    document.getElementById('customerHistoryModal').showModal();

    try {
        const { data: sales } = await supabaseClient
            .from('sales')
            .select('*')
            .or(`customer_id.eq.${customerId},customer_name_snapshot.eq."${customerName}"`)
            .order('created_at', { ascending: false });

        tbody.innerHTML = '';
        if (!sales || sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay ventas para este cliente.</td></tr>';
            return;
        }

        sales.forEach(s => {
            const d = new Date(s.created_at).toLocaleDateString();
            const estado = s.is_voided ? '<span style="color:var(--danger-red);font-size:12px;font-weight:bold;">Anulada</span>' : '<span style="color:var(--success-green);font-size:12px;font-weight:bold;">Activa</span>';
            const tr = document.createElement('tr');
            if (s.is_voided) tr.style.opacity = '0.6';
            tr.innerHTML = `
                <td>${d}</td>
                <td>${s.product_name_snapshot}</td>
                <td>${s.quantity}</td>
                <td>S/ ${Number(s.total).toFixed(2)}</td>
                <td>${estado}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Error al cargar historial.</td></tr>';
    }
};
document.getElementById('btnCloseCustomerHistoryModal')?.addEventListener('click', () => document.getElementById('customerHistoryModal').close());


// --- VENTAS ---
const newSaleForm = document.getElementById('newSaleForm');
const saleSelectProduct = document.getElementById('saleSelectProduct');
const saleSelectCustomer = document.getElementById('saleSelectCustomer');
const saleQuantity = document.getElementById('saleQuantity');
const saleTotalAmount = document.getElementById('saleTotalAmount');
const saleProfitAmount = document.getElementById('saleProfitAmount');
const saleIgv = document.getElementById('saleIgv');
const saleShippingCost = document.getElementById('saleShippingCost');
const saleShippingType = document.getElementById('saleShippingType');
const saleShippingMode = document.getElementById('saleShippingMode');
const saleManualCustomer = document.getElementById('saleManualCustomer');
const saleProductSearch = document.getElementById('saleProductSearch');

const saleType = document.getElementById('saleType');
const salePaymentMethodContainer = document.getElementById('salePaymentMethodContainer');
const saleDueDateContainer = document.getElementById('saleDueDateContainer');
const saleDueDate = document.getElementById('saleDueDate');
const salePaymentMethod = document.getElementById('salePaymentMethod');
const saleDeliveryStatus = document.getElementById('saleDeliveryStatus');

saleType?.addEventListener('change', (e) => {
    if (e.target.value === 'contado') {
        if (salePaymentMethodContainer) salePaymentMethodContainer.style.display = 'flex';
        if (saleDueDateContainer) saleDueDateContainer.style.display = 'none';
        if (saleDueDate) {
            saleDueDate.required = false;
            saleDueDate.value = '';
        }
        if (salePaymentMethod) salePaymentMethod.value = 'Efectivo';
    } else {
        if (salePaymentMethodContainer) salePaymentMethodContainer.style.display = 'none';
        if (saleDueDateContainer) saleDueDateContainer.style.display = 'flex';
        if (saleDueDate) saleDueDate.required = true;
        if (salePaymentMethod) salePaymentMethod.value = '';
    }
});

function matchesProductSearch(product, searchTerm) {
    const term = String(searchTerm || '').toLowerCase().trim();
    const termNoDash = term.replace(/-/g, '');
    const name = String(product.name || '').toLowerCase();
    const code = String(product.product_code || '').toLowerCase();
    const codeNoDash = code.replace(/-/g, '');

    return (
        !term ||
        name.includes(term) ||
        code.includes(term) ||
        codeNoDash.includes(termNoDash) ||
        `${code} ${name}`.includes(term)
    );
}

function renderSaleProductResults(searchTerm) {
    const resultsBox = document.getElementById('saleProductResults');
    if (!resultsBox) return;

    const products = window._currentSaleProducts || [];
    const term = String(searchTerm || '').trim();

    resultsBox.innerHTML = '';

    if (!term) {
        resultsBox.style.display = 'none';
        return;
    }

    const filtered = products
        .filter(p => Number(p.stock || 0) > 0)
        .filter(p => matchesProductSearch(p, term))
        .slice(0, 12);

    if (filtered.length === 0) {
        resultsBox.innerHTML = '<div class="sale-product-result-empty">Sin coincidencias</div>';
        resultsBox.style.display = 'block';
        return;
    }

    filtered.forEach(p => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'sale-product-result-item';

        const title = document.createElement('span');
        title.className = 'sale-product-result-title';
        title.textContent = `${p.product_code ? p.product_code + ' — ' : ''}${p.name}`;

        const meta = document.createElement('span');
        meta.className = 'sale-product-result-meta';
        meta.textContent = `Stock: ${p.stock} | S/ ${Number(p.sale_price).toFixed(2)}`;

        item.appendChild(title);
        item.appendChild(meta);

        item.addEventListener('click', () => {
            saleProductSearch.value = `${p.product_code ? p.product_code + ' — ' : ''}${p.name}`;
            saleSelectProduct.value = p.id;
            saleSelectProduct.dispatchEvent(new Event('change'));
            resultsBox.innerHTML = '';
            resultsBox.style.display = 'none';
            calculateSaleTotals();
        });

        resultsBox.appendChild(item);
    });

    resultsBox.style.display = 'block';
}

async function loadSalesForm() {
    let products = [];
    let customers = [];
    try {
        products = await fetchProductsFromSupabase();
        customers = await fetchCustomersFromSupabase();
    } catch (e) { }

    window._currentSaleProducts = products;

    saleSelectProduct.innerHTML = '<option value="" disabled selected>-- Seleccionar Producto --</option>';
    products.forEach(p => {
        if (p.stock > 0) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.dataset.price = p.sale_price;
            opt.dataset.cost = p.cost;
            opt.dataset.stock = p.stock;
            opt.dataset.code = p.product_code || '';
            opt.textContent = `${p.product_code ? p.product_code + ' - ' : ''}${p.name} - S/ ${p.sale_price} (Stock: ${p.stock})`;
            saleSelectProduct.appendChild(opt);
        }
    });

    saleSelectCustomer.innerHTML = '<option value="">Cliente manual / mostrador</option>';
    customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        saleSelectCustomer.appendChild(opt);
    });

    saleQuantity.value = 1;
    saleIgv.value = '0.00';
    saleShippingCost.value = '0.00';
    saleManualCustomer.value = '';
    const resultsBox = document.getElementById('saleProductResults');
    if (saleProductSearch) saleProductSearch.value = '';
    if (resultsBox) {
        resultsBox.innerHTML = '';
        resultsBox.style.display = 'none';
    }

    if (saleType) {
        saleType.value = 'contado';
        saleType.dispatchEvent(new Event('change'));
    }
    if (saleDeliveryStatus) saleDeliveryStatus.value = 'Entregado';

    calculateSaleTotals();
}

let currentSaleCart = [];

function renderSaleCart() {
    const container = document.getElementById('saleCartItems');
    const subtotalEl = document.getElementById('saleCartSubtotal');
    if (!container || !subtotalEl) return;
    
    container.innerHTML = '';
    let subtotal = 0;
    
    if (currentSaleCart.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 8px 0; opacity: 0.6;">Sin productos agregados</div>';
    } else {
        currentSaleCart.forEach((item, index) => {
            subtotal += item.total;
            
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
            div.style.paddingBottom = '4px';
            
            div.innerHTML = `
                <div style="flex: 1;">
                    <strong style="color: var(--text-primary);">${item.product_name_snapshot}</strong><br>
                    <span style="font-size: 11px;">${item.quantity} x S/ ${item.unit_price.toFixed(2)}</span>
                </div>
                <div style="text-align: right; margin-right: 12px;">
                    <strong style="color: var(--accent-blue);">S/ ${item.total.toFixed(2)}</strong>
                </div>
            `;
            
            const btnRemove = document.createElement('button');
            btnRemove.textContent = '❌';
            btnRemove.style.cssText = 'background:none; border:none; cursor:pointer; font-size:10px;';
            btnRemove.addEventListener('click', () => {
                currentSaleCart.splice(index, 1);
                renderSaleCart();
            });
            
            div.appendChild(btnRemove);
            container.appendChild(div);
        });
    }
    
    subtotalEl.textContent = subtotal.toFixed(2);
    calculateSaleTotals();
}

document.getElementById('btnAddSaleCart')?.addEventListener('click', () => {
    const selectedOpt = saleSelectProduct.options[saleSelectProduct.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) {
        return showToast('Selecciona un producto primero.', '⚠️');
    }

    const productId = selectedOpt.value;
    const selectedProduct = (window._currentSaleProducts || []).find(p => String(p.id) === String(productId));
    const productName = selectedProduct
        ? `${selectedProduct.product_code ? selectedProduct.product_code + ' — ' : ''}${selectedProduct.name}`
        : selectedOpt.textContent.split(' - S/ ')[0];
        
    const price = parseFloat(selectedOpt.dataset.price);
    const cost = parseFloat(selectedOpt.dataset.cost);
    const maxStock = parseInt(selectedOpt.dataset.stock);
    let qty = parseInt(saleQuantity.value) || 1;

    if (qty <= 0) return showToast('Cantidad debe ser mayor a 0.', '⚠️');

    const existingIndex = currentSaleCart.findIndex(i => i.product_id === productId);
    let currentQtyInCart = 0;
    if (existingIndex >= 0) {
        currentQtyInCart = currentSaleCart[existingIndex].quantity;
    }

    if (currentQtyInCart + qty > maxStock) {
        return showToast(`Stock insuficiente. Disponible: ${maxStock}, en carrito: ${currentQtyInCart}`, '⚠️');
    }

    if (existingIndex >= 0) {
        currentSaleCart[existingIndex].quantity += qty;
        currentSaleCart[existingIndex].total = currentSaleCart[existingIndex].quantity * price;
        currentSaleCart[existingIndex].profit = currentSaleCart[existingIndex].quantity * (price - cost);
    } else {
        currentSaleCart.push({
            product_id: productId,
            product_name_snapshot: productName,
            quantity: qty,
            unit_price: price,
            unit_cost: cost,
            total: qty * price,
            profit: qty * (price - cost),
            stock_available: maxStock
        });
    }

    saleQuantity.value = 1;
    if (saleProductSearch) saleProductSearch.value = '';
    renderSaleCart();
});

function calculateSaleTotals() {
    let totalItems = 0;
    let profitItems = 0;
    
    currentSaleCart.forEach(item => {
        totalItems += item.total;
        profitItems += item.profit;
    });

    let shippingCost = parseFloat(saleShippingCost.value) || 0;
    let shippingMode = saleShippingMode.value;

    let total = totalItems;
    let profit = profitItems;

    if (shippingMode === 'sumar_al_precio') {
        total += shippingCost;
    } else if (shippingMode === 'costo_interno') {
        profit -= shippingCost;
    }

    if (document.activeElement !== saleIgv) {
        saleIgv.value = (total * 0.18).toFixed(2);
    }

    const tEl = document.getElementById('saleCartTotal');
    const pEl = document.getElementById('saleCartProfit');
    if(tEl) tEl.textContent = total.toFixed(2);
    if(pEl) pEl.textContent = profit.toFixed(2);
}

saleSelectProduct.addEventListener('change', calculateSaleTotals);
saleShippingCost.addEventListener('input', calculateSaleTotals);
saleShippingMode.addEventListener('change', calculateSaleTotals);

saleProductSearch?.addEventListener('input', function () {
    renderSaleProductResults(this.value);
});

newSaleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (currentSaleCart.length === 0) {
        return showToast('Agrega al menos un producto al carrito.', '⚠️');
    }

    let customerId = saleSelectCustomer.value || null;
    let customerName = "Cliente mostrador";
    if (customerId) {
        customerName = saleSelectCustomer.options[saleSelectCustomer.selectedIndex].text;
    } else {
        const manual = saleManualCustomer.value.trim();
        if (manual) customerName = manual;
    }

    let profile;
    try { profile = await getCurrentProfile(); } catch (e) { return showToast('Error perfil', '❌'); }

    const shippingCost = parseFloat(saleShippingCost.value) || 0;
    const shippingType = saleShippingType.value;
    const shippingMode = saleShippingMode.value;
    const igv = parseFloat(saleIgv.value) || 0;

    let totalItems = 0;
    let profitItems = 0;
    let totalQty = 0;
    
    currentSaleCart.forEach(item => {
        totalItems += item.total;
        profitItems += item.profit;
        totalQty += item.quantity;
    });

    let total = totalItems;
    let profit = profitItems;

    if (shippingMode === 'sumar_al_precio') {
        total += shippingCost;
    } else if (shippingMode === 'costo_interno') {
        profit -= shippingCost;
    }

    const sType = saleType?.value || 'contado';
    const sPaymentMethod = sType === 'contado' ? (salePaymentMethod?.value || 'Efectivo') : null;
    const sDueDate = sType === 'credito' ? saleDueDate?.value : null;

    if (sType === 'credito' && !sDueDate) {
        showToast('Debe ingresar fecha de vencimiento para ventas al crédito.', '⚠️');
        return;
    }

    const sPaymentStatus = sType === 'contado' ? 'pagado' : 'pendiente';
    const sBalanceDue = sType === 'contado' ? 0 : total;
    const sDeliveryStatus = saleDeliveryStatus?.value || 'Entregado';

    const multiSaleName = currentSaleCart.length === 1 
        ? currentSaleCart[0].product_name_snapshot 
        : `Venta múltiple (${currentSaleCart.length} ítems)`;
        
    const mainProductId = currentSaleCart[0].product_id;

    const salePayload = {
        tenant_id: String(profile.tenant_id),
        product_id: mainProductId,
        customer_id: customerId,
        product_name_snapshot: multiSaleName,
        customer_name_snapshot: customerName,
        quantity: totalQty,
        unit_price: totalItems,
        unit_cost: totalItems - profitItems,
        total: total,
        profit: profit,
        igv: igv,
        shipping_cost: shippingCost,
        shipping_type: shippingType,
        shipping_mode: shippingMode,
        sale_type: sType,
        payment_method: sPaymentMethod,
        due_date: sDueDate,
        payment_status: sPaymentStatus,
        balance_due: sBalanceDue,
        delivery_status: sDeliveryStatus,
        created_by: profile.id,
        is_voided: false
    };

    const { data: saleData, error: saleErr } = await supabaseClient
        .from('sales')
        .insert(salePayload)
        .select('id')
        .single();

    if (saleErr) {
        console.error('ERROR REAL AL GUARDAR VENTA:', saleErr);
        return showToast(`Error venta: ${saleErr.message}`, '❌');
    }

    const newSaleId = saleData.id;

    const saleItemsPayload = currentSaleCart.map(item => ({
        tenant_id: String(profile.tenant_id),
        sale_id: newSaleId,
        product_id: item.product_id,
        product_name_snapshot: item.product_name_snapshot,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost,
        total: item.total
    }));

    const { error: itemsErr } = await supabaseClient
        .from('sale_items')
        .insert(saleItemsPayload);

    if (itemsErr) {
        console.error('Error insertando sale_items:', itemsErr);
        await supabaseClient.from('sales').delete().eq('id', newSaleId);
        return showToast('Error guardando detalle. Venta anulada.', '❌');
    }

    for (const item of currentSaleCart) {
        const { error: stockErr } = await supabaseClient.from('products').update({ 
            stock: item.stock_available - item.quantity 
        }).eq('id', item.product_id);
        
        if (stockErr) {
            console.error(`Error actualizando stock para producto ${item.product_id}:`, stockErr);
            await supabaseClient.from('sale_items').delete().eq('sale_id', newSaleId);
            await supabaseClient.from('sales').delete().eq('id', newSaleId);
            return showToast('Error actualizando stock. Venta revertida.', '❌');
        }
    }

    document.getElementById('successSaleModal').showModal();
    newSaleForm.reset();
    currentSaleCart = [];
    renderSaleCart();
    await loadSalesForm();
    await updateDashboard();
    await updateReports();
});

document.getElementById('btnSuccessSaleOk')?.addEventListener('click', () => {
    document.getElementById('successSaleModal').close();
});


// --- INICIO & REPORTES (METRICAS) ---
async function updateDashboard() {
    let sales = [], products = [];
    try {
        sales = await fetchSalesFromSupabase();
        products = await fetchProductsFromSupabase();
    } catch (e) { }

    let todaySales = 0;
    let todayProfit = 0;
    const todayStr = new Date().toDateString();

    const recentList = document.getElementById('dashRecentSalesList');
    recentList.innerHTML = '';

    let renderedCount = 0;
    sales.forEach(s => {
        if (s.is_voided) return;

        const d = new Date(s.created_at);
        if (d.toDateString() === todayStr) {
            todaySales += s.total;
            todayProfit += s.profit;
        }

        if (renderedCount < 5) {
            const li = document.createElement('li');
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            li.innerHTML = `
                <span><strong>${s.quantity}x</strong> ${s.product_name_snapshot} <span style="font-size: 13px; color: var(--text-secondary); margin-left: 8px;">${time}</span></span>
                <strong style="color: var(--accent-blue);">S/ ${s.total.toFixed(2)}</strong>
            `;
            recentList.appendChild(li);
            renderedCount++;
        }
    });

    if (renderedCount === 0) {
        recentList.innerHTML = `<div class="empty-state" style="padding: 32px 16px;">
            <div class="empty-icon" style="font-size: 32px;">🛒</div>
            <div class="empty-text">No hay ventas registradas el día de hoy.</div>
        </div>`;
    }

    document.getElementById('dashTodaySales').textContent = 'S/ ' + todaySales.toFixed(2);
    document.getElementById('dashTodayProfit').textContent = 'S/ ' + todayProfit.toFixed(2);

    const lowStockCount = products.filter(p => p.stock <= 5).length;
    document.getElementById('dashLowStock').textContent = lowStockCount;
    document.getElementById('dashLowStock').style.color = lowStockCount > 0 ? 'var(--danger-red)' : 'inherit';

    if (typeof renderCreditAlerts === 'function') await renderCreditAlerts();
}

async function updateReports() {
    const timeframe = document.getElementById('reportTimeframe').value;
    let sales = [];
    try { sales = await fetchSalesFromSupabase(); } catch (e) { }

    const now = new Date();
    let filteredSalesForTable = sales;

    if (timeframe !== 'all') {
        const days = parseInt(timeframe);
        const cutoffTime = now.getTime() - (days * 24 * 60 * 60 * 1000);
        filteredSalesForTable = sales.filter(s => new Date(s.created_at).getTime() >= cutoffTime);
    }

    const filteredSalesForMetrics = filteredSalesForTable.filter(s => !s.is_voided);

    const totalSales = filteredSalesForMetrics.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalProfit = filteredSalesForMetrics.reduce((sum, s) => sum + Number(s.profit || 0), 0);

    document.getElementById('reportTotalSales').textContent = 'S/ ' + totalSales.toFixed(2);
    document.getElementById('reportTotalProfit').textContent = 'S/ ' + totalProfit.toFixed(2);

    const tbody = document.getElementById('reportsDetailTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filteredSalesForTable.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No hay ventas en este periodo.</td></tr>';
    } else {
        filteredSalesForTable.forEach(s => {
            const dateStr = new Date(s.created_at).toLocaleDateString();
            const costoTotal = (s.unit_cost || 0) * s.quantity;
            let percentFormat = '-';
            if (costoTotal > 0) {
                percentFormat = ((s.profit / costoTotal) * 100).toFixed(1) + '%';
            } else if (s.profit > 0) {
                percentFormat = '100%';
            }

            const estado = s.is_voided ? '<span style="color:var(--danger-red);font-weight:bold;font-size:12px;">Anulada</span>' : '<span style="color:var(--success-green);font-weight:bold;font-size:12px;">Activa</span>';

            const tr = document.createElement('tr');
            if (s.is_voided) tr.style.opacity = '0.6';
            tr.classList.add('sale-row-clickable');
            tr.addEventListener('click', () => {
                openSaleDetailModal(s);
            });
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${s.product_name_snapshot}</td>
                <td>${s.customer_name_snapshot || '-'}</td>
                <td>${s.quantity}</td>
                <td>S/ ${Number(s.total || 0).toFixed(2)}</td>
                <td>S/ ${costoTotal.toFixed(2)}</td>
                <td>S/ ${Number(s.profit || 0).toFixed(2)}</td>
                <td>${percentFormat}</td>
                <td>S/ ${Number(s.igv || 0).toFixed(2)}</td>
                <td>S/ ${Number(s.shipping_cost || 0).toFixed(2)}</td>
                <td>${estado}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

document.getElementById('reportTimeframe').addEventListener('change', updateReports);

// --- SALE DETAIL MODAL ---
window.openSaleDetailModal = async function(sale) {
    const modal = document.getElementById('saleDetailModal');
    const tbody = document.getElementById('sdmItemsBody');
    if (!modal || !tbody) return;

    // Llenar cabecera
    document.getElementById('sdmCustomer').textContent = sale.customer_name_snapshot || 'Cliente mostrador';
    document.getElementById('sdmDate').textContent = new Date(sale.created_at).toLocaleString();
    document.getElementById('sdmStatus').textContent = sale.payment_status || 'Pendiente';
    document.getElementById('sdmType').textContent = sale.sale_type || 'Contado';
    document.getElementById('sdmTotal').textContent = 'S/ ' + Number(sale.total || 0).toFixed(2);

    // Limpiar tabla
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Cargando ítems...</td></tr>';
    modal.showModal();

    try {
        const { data: items, error } = await supabaseClient
            .from('sale_items')
            .select('*')
            .eq('sale_id', sale.id);

        if (error) throw error;

        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-secondary);">Sin detalle disponible</td></tr>';
        } else {
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(0,0,0,0.04)';

                const tdProd = document.createElement('td');
                tdProd.style.padding = '8px';
                // El snapshot del nombre del producto no está en sale_items, 
                // en una fase real se sacaría de products o se guardaría snapshot en sale_items.
                // Por ahora usamos el ID o un placeholder si no hay snapshot en item.
                tdProd.textContent = item.product_name_snapshot || `Producto ID: ${item.product_id}`;

                const tdQty = document.createElement('td');
                tdQty.style.padding = '8px';
                tdQty.style.textAlignment = 'center';
                tdQty.style.textAlign = 'center';
                tdQty.textContent = item.quantity;

                const tdPrice = document.createElement('td');
                tdPrice.style.padding = '8px';
                tdPrice.style.textAlign = 'right';
                tdPrice.textContent = 'S/ ' + Number(item.unit_price || 0).toFixed(2);

                const tdSub = document.createElement('td');
                tdSub.style.padding = '8px';
                tdSub.style.textAlign = 'right';
                tdSub.style.fontWeight = 'bold';
                tdSub.textContent = 'S/ ' + Number(item.total || 0).toFixed(2);

                tr.appendChild(tdProd);
                tr.appendChild(tdQty);
                tr.appendChild(tdPrice);
                tr.appendChild(tdSub);
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error('Error cargando detalle:', err);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--danger-red);">Error al cargar el detalle</td></tr>';
    }
};

// --- SALES HISTORY LOGIC ---
async function renderSalesHistory() {
    const tbody = document.getElementById('salesHistoryTableBody');
    tbody.innerHTML = '';
    let sales = [];
    try { sales = await fetchSalesFromSupabase(); } catch (e) { }

    if (sales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
            <div class="empty-icon">📜</div>
            <div class="empty-text">No hay ventas registradas todavía.</div>
        </div></td></tr>`;
        return;
    }

    sales.forEach(s => {
        const d = new Date(s.created_at);
        const formattedDate = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const isVoided = s.is_voided === true;
        const rowStyle = isVoided ? 'opacity: 0.6; background-color: rgba(255, 69, 58, 0.06);' : '';

        let statusBadge = '';
        if (isVoided) {
            statusBadge = '<span style="color:var(--danger-red); font-size:12px; font-weight:bold;">Anulada</span>';
        } else {
            const typeStr = s.sale_type === 'credito' ? 'CRÉDITO' : 'CONTADO';
            const payStatus = s.payment_status === 'pendiente' ? 'Pendiente' : (s.payment_status === 'parcial' ? 'Parcial' : 'Pagado');
            const typeColor = s.sale_type === 'credito' ? 'var(--accent-blue)' : 'var(--text-secondary)';
            const payColor = s.payment_status === 'pagado' ? 'var(--success-green)' : (s.payment_status === 'parcial' ? 'orange' : 'var(--danger-red)');
            const balanceText = s.sale_type === 'credito' ? `<br><span style="font-size:11px; color:var(--text-secondary);">Saldo: S/ ${Number(s.balance_due || 0).toFixed(2)}</span>` : '';

            statusBadge = `
                <div style="display:flex; flex-direction:column; gap:2px; line-height:1.2;">
                    <span style="color:${typeColor}; font-size:11px; font-weight:bold;">${typeStr}</span>
                    <span style="color:${payColor}; font-size:12px; font-weight:bold;">${payStatus}</span>
                    ${balanceText}
                </div>
            `;
        }

        const tdActions = document.createElement('td');
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.gap = '8px';
        container.style.alignItems = 'center';

        if (isVoided) {
            const naSpan = document.createElement('span');
            naSpan.style.cssText = 'color:var(--text-secondary); font-size:12px;';
            naSpan.textContent = 'N/A';
            container.appendChild(naSpan);
        } else {
            if (s.sale_type === 'credito') {
                const productName = s.product_name_snapshot || '';
                const customerName = s.customer_name_snapshot || 'Cliente mostrador';

                if (s.payment_status !== 'pagado') {
                    const btnCobrar = document.createElement('button');
                    btnCobrar.textContent = 'Cobrar';
                    btnCobrar.style.cssText = 'background:var(--success-green);color:white;border:none;border-radius:4px;padding:4px 8px;font-size:11px;font-weight:bold;cursor:pointer;';
                    btnCobrar.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openPaymentModal(s.id, productName, customerName, s.balance_due);
                    });
                    container.appendChild(btnCobrar);
                }

                const btnVerPagos = document.createElement('button');
                btnVerPagos.textContent = 'Ver pagos';
                btnVerPagos.style.cssText = 'background:var(--accent-blue);color:white;border:none;border-radius:4px;padding:4px 8px;font-size:11px;font-weight:bold;cursor:pointer;';
                btnVerPagos.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openPaymentsHistoryModal(s.id, productName, customerName, s.total, s.balance_due);
                });
                container.appendChild(btnVerPagos);
            }

            const btnAnular = document.createElement('button');
            btnAnular.textContent = '🗑️';
            btnAnular.title = 'Anular Venta';
            btnAnular.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--danger-red);font-size:16px;';
            btnAnular.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteSale(s.id, s.product_id, s.quantity);
            });
            container.appendChild(btnAnular);
        }

        if (canHardDeleteSales()) {
            const btnHardDelete = document.createElement('button');
            btnHardDelete.textContent = 'Eliminar';
            btnHardDelete.title = 'Eliminar Venta Definitivamente';
            btnHardDelete.style.cssText = 'background:var(--text-primary);color:white;border:none;border-radius:4px;padding:4px 8px;font-size:11px;font-weight:bold;cursor:pointer;margin-left:8px;';
            btnHardDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                const productName = s.product_name_snapshot || '';
                const customerName = s.customer_name_snapshot || 'Cliente mostrador';
                openHardDeleteSaleModal(s.id, productName, customerName, s.total);
            });
            container.appendChild(btnHardDelete);
        }
        
        tdActions.appendChild(container);

        const tr = document.createElement('tr');
        if (rowStyle) tr.style.cssText = rowStyle;
        tr.classList.add('sale-row-clickable');
        tr.addEventListener('click', () => {
            openSaleDetailModal(s);
        });
        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td><strong>${s.product_name_snapshot}</strong></td>
            <td>${s.quantity}</td>
            <td>${s.customer_name_snapshot || 'Cliente mostrador'}</td>
            <td><strong>S/ ${s.total.toFixed(2)}</strong></td>
            <td style="color: var(--success-green);">S/ ${s.profit.toFixed(2)}</td>
            <td>${statusBadge}</td>
        `;
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
    });
}

window.deleteSale = function (saleId, productId, qty) {
    showConfirm('Anular Venta', '¿Estás seguro de que deseas anular esta venta? El stock será devuelto al inventario.', async () => {

        let profile;
        try { profile = await getCurrentProfile(); } catch (e) { return showToast('Error de usuario', '❌'); }

        if (productId) {
            const { data: p } = await supabaseClient.from('products').select('stock').eq('id', productId).single();
            if (p) {
                await supabaseClient.from('products').update({ stock: p.stock + qty }).eq('id', productId);
            }
        }

        await supabaseClient.from('sales').update({
            is_voided: true,
            voided_at: new Date().toISOString(),
            voided_by: profile.id
        }).eq('id', saleId);

        showToast('Venta anulada y stock restaurado.', '↩️');
        await renderSalesHistory();
        await updateDashboard();
        await updateReports();
    });
};

// --- COBROS (PAYMENTS) ---
const paymentModal = document.getElementById('paymentModal');
const paymentForm = document.getElementById('paymentForm');

window.openPaymentModal = function(saleId, productName, customerName, balanceDue) {
    document.getElementById('paymentSaleId').value = saleId;
    document.getElementById('paymentMaxAmount').value = balanceDue;
    document.getElementById('paymentSaleInfo').textContent = `${productName} - ${customerName}`;
    document.getElementById('paymentBalanceDue').textContent = Number(balanceDue).toFixed(2);
    
    document.getElementById('paymentAmount').value = Number(balanceDue).toFixed(2);
    document.getElementById('paymentAmount').max = balanceDue;
    document.getElementById('paymentMethod').value = 'Efectivo';
    
    const fileInput = document.getElementById('paymentVoucherFile');
    if (fileInput) fileInput.value = '';
    
    paymentModal.showModal();
};

document.getElementById('btnPaymentModalClose')?.addEventListener('click', () => {
    paymentModal.close();
});
document.getElementById('btnPaymentCancel')?.addEventListener('click', () => {
    paymentModal.close();
});

paymentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = paymentForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const saleId = document.getElementById('paymentSaleId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const method = document.getElementById('paymentMethod').value;
    const maxAmount = parseFloat(document.getElementById('paymentMaxAmount').value);
    
    if (amount <= 0) {
        if (submitBtn) submitBtn.disabled = false;
        return showToast('El monto debe ser mayor a 0', '⚠️');
    }
    if (amount > maxAmount) {
        if (submitBtn) submitBtn.disabled = false;
        return showToast('El monto no puede superar el saldo pendiente', '⚠️');
    }
    
    let profile;
    try { 
        profile = await getCurrentProfile(); 
    } catch (err) { 
        if (submitBtn) submitBtn.disabled = false;
        return showToast('Error perfil', '❌'); 
    }
    
    let voucherPath = null;
    const fileInput = document.getElementById('paymentVoucherFile');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        if (file.size > 3 * 1024 * 1024) {
            if (submitBtn) submitBtn.disabled = false;
            return showToast('El comprobante no debe superar los 3 MB', '⚠️');
        }
        
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            if (submitBtn) submitBtn.disabled = false;
            return showToast('Formato de comprobante no válido', '⚠️');
        }
        
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const filePath = `${profile.tenant_id}/${saleId}/${Date.now()}-${safeName}`;
        
        const { error: uploadErr } = await supabaseClient.storage.from('vouchers').upload(filePath, file);
        if (uploadErr) {
            console.error('Error al subir comprobante:', uploadErr);
            if (submitBtn) submitBtn.disabled = false;
            return showToast('Error al subir el comprobante', '❌');
        }
        
        voucherPath = filePath;
    }
    
    const { error: insertErr } = await supabaseClient.from('sale_payments').insert({
        tenant_id: String(profile.tenant_id),
        sale_id: saleId,
        amount: amount,
        payment_method: method,
        payment_voucher_path: voucherPath,
        created_by: profile.id
    });
    
    if (insertErr) {
        console.error('Error al registrar cobro:', insertErr);
        if (submitBtn) submitBtn.disabled = false;
        return showToast('Error al registrar el cobro', '❌');
    }
    
    const newBalanceRaw = maxAmount - amount;
    const newBalance = Math.max(0, Number(newBalanceRaw.toFixed(2)));
    const newStatus = newBalance <= 0 ? 'pagado' : 'parcial';
    
    const { error: updateErr } = await supabaseClient.from('sales').update({
        balance_due: newBalance,
        payment_status: newStatus
    }).eq('id', saleId);
    
    if (updateErr) {
        console.error('Error al actualizar venta:', updateErr);
        if (submitBtn) submitBtn.disabled = false;
        return showToast('Cobro registrado pero error al actualizar venta', '⚠️');
    }
    
    paymentModal.close();
    
    if (newStatus === 'pagado') {
        showToast('Pago completo registrado correctamente', '✅');
    } else {
        showToast('Pago parcial registrado correctamente', '✅');
    }
    
    await renderSalesHistory();
    if (typeof renderPaymentsView === 'function') await renderPaymentsView();
    await updateDashboard();
    await updateReports();
    
    if (submitBtn) submitBtn.disabled = false;
});

// --- HISTORIAL DE PAGOS ---
const paymentsHistoryModal = document.getElementById('paymentsHistoryModal');

window.openPaymentsHistoryModal = async function(saleId, productName, customerName, total, balance) {
    document.getElementById('paymentsHistorySaleInfo').textContent = `${productName} - ${customerName}`;
    document.getElementById('paymentsHistoryTotal').textContent = Number(total).toFixed(2);
    document.getElementById('paymentsHistoryBalance').textContent = Number(balance).toFixed(2);
    
    const tbody = document.getElementById('paymentsHistoryTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Cargando pagos...</td></tr>';
    
    paymentsHistoryModal.showModal();
    
    const { data: payments, error } = await supabaseClient
        .from('sale_payments')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: false });
        
    if (error) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--danger-red);">Error al cargar historial</td></tr>';
        return;
    }
    
    let totalPagado = 0;
    if (payments && payments.length > 0) {
        tbody.innerHTML = '';
        payments.forEach(p => {
            totalPagado += Number(p.amount);
            
            const tr = document.createElement('tr');
            
            const tdFecha = document.createElement('td');
            tdFecha.style.fontSize = '12px';
            tdFecha.style.padding = '12px';
            tdFecha.textContent = new Date(p.created_at).toLocaleString();

            const tdMonto = document.createElement('td');
            tdMonto.style.fontSize = '13px';
            tdMonto.style.fontWeight = 'bold';
            tdMonto.style.padding = '12px';
            tdMonto.textContent = `S/ ${Number(p.amount).toFixed(2)}`;

            const tdMetodo = document.createElement('td');
            tdMetodo.style.fontSize = '12px';
            tdMetodo.style.padding = '12px';
            tdMetodo.textContent = p.payment_method;

            const tdComprobante = document.createElement('td');
            tdComprobante.style.fontSize = '12px';
            tdComprobante.style.padding = '12px';
            tdComprobante.style.textAlign = 'center';
            if (p.payment_voucher_path) {
                const btnVer = document.createElement('button');
                btnVer.textContent = 'Ver';
                btnVer.style.cssText = 'background:var(--accent-blue);color:white;border:none;border-radius:4px;padding:4px 8px;font-size:11px;font-weight:bold;cursor:pointer;';
                btnVer.addEventListener('click', () => {
                    openPaymentVoucher(p.payment_voucher_path);
                });
                tdComprobante.appendChild(btnVer);
            } else {
                tdComprobante.textContent = '-';
            }

            tr.appendChild(tdFecha);
            tr.appendChild(tdMonto);
            tr.appendChild(tdMetodo);
            tr.appendChild(tdComprobante);
            
            tbody.appendChild(tr);
        });
        
        totalPagado = Number(totalPagado.toFixed(2));
    } else {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-secondary); font-size:13px;">Sin pagos registrados</td></tr>';
    }
    
    document.getElementById('paymentsHistoryPaid').textContent = totalPagado.toFixed(2);
};

window.openPaymentVoucher = async function(path) {
    if (!path) return;
    
    try {
        const { data, error } = await supabaseClient.storage.from('vouchers').createSignedUrl(path, 60);
        if (error || !data) {
            console.error('Error al generar url:', error);
            return showToast('No se pudo abrir el comprobante', '❌');
        }
        window.open(data.signedUrl, '_blank');
    } catch (err) {
        console.error(err);
        showToast('Error al procesar el comprobante', '❌');
    }
};

document.getElementById('btnPaymentsHistoryModalClose')?.addEventListener('click', () => {
    paymentsHistoryModal.close();
});

// --- HARD DELETE SALE ---
const hardDeleteSaleModal = document.getElementById('hardDeleteSaleModal');
let currentHardDeleteSaleId = null;

window.openHardDeleteSaleModal = function(saleId, productName, customerName, total) {
    currentHardDeleteSaleId = saleId;
    document.getElementById('hardDeleteSaleInfo').textContent = `${productName} - ${customerName}`;
    document.getElementById('hardDeleteSaleTotal').textContent = Number(total).toFixed(2);
    document.getElementById('hardDeleteConfirmInput').value = '';
    
    hardDeleteSaleModal.showModal();
};

document.getElementById('btnHardDeleteCancel')?.addEventListener('click', () => {
    hardDeleteSaleModal.close();
});

document.getElementById('btnHardDeleteConfirm')?.addEventListener('click', async () => {
    const inputVal = document.getElementById('hardDeleteConfirmInput').value;
    if (inputVal !== 'ELIMINAR') {
        return showToast('Debe escribir ELIMINAR para confirmar', '⚠️');
    }
    
    const btn = document.getElementById('btnHardDeleteConfirm');
    if (btn) btn.disabled = true;
    
    try {
        const { data: payments } = await supabaseClient
            .from('sale_payments')
            .select('id, payment_voucher_path')
            .eq('sale_id', currentHardDeleteSaleId);
            
        if (payments && payments.length > 0) {
            const voucherPaths = payments
                .map(p => p.payment_voucher_path)
                .filter(path => typeof path === 'string' && path.trim() !== '');
                
            if (voucherPaths.length > 0) {
                const { error: storageErr } = await supabaseClient.storage.from('vouchers').remove(voucherPaths);
                if (storageErr) {
                    console.warn('Error borrando vouchers en storage:', storageErr);
                }
            }
            
            const { error: paymentsErr } = await supabaseClient
                .from('sale_payments')
                .delete()
                .eq('sale_id', currentHardDeleteSaleId);
                
            if (paymentsErr) {
                if (btn) btn.disabled = false;
                console.error(paymentsErr);
                return showToast('Error al borrar pagos asociados', '❌');
            }
        }
        
        const { error: saleErr } = await supabaseClient
            .from('sales')
            .delete()
            .eq('id', currentHardDeleteSaleId);
            
        if (saleErr) {
            if (btn) btn.disabled = false;
            console.error(saleErr);
            return showToast('Error al eliminar venta', '❌');
        }
        
        hardDeleteSaleModal.close();
        showToast('Venta eliminada definitivamente', '✅');
        
        await renderSalesHistory();
        if (typeof renderPaymentsView === 'function') await renderPaymentsView();
        await updateDashboard();
        await updateReports();
        
    } catch (err) {
        console.error(err);
        showToast('Error inesperado al eliminar', '❌');
    } finally {
        if (btn) btn.disabled = false;
    }
});

// --- COBROS VIEW ---
async function renderPaymentsView() {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Cargando cuentas por cobrar...</td></tr>';

    try {
        const { data: sales, error } = await supabaseClient
            .from('sales')
            .select('*')
            .eq('sale_type', 'credito')
            .eq('is_voided', false)
            .neq('payment_status', 'pagado')
            .order('due_date', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw error;

        let totalDue = 0;
        let totalOverdue = 0;
        let totalDueToday = 0;
        let activeCredits = 0;

        tbody.innerHTML = '';

        if (!sales || sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-secondary);">Sin cuentas por cobrar pendientes</td></tr>';
            document.getElementById('paymentsTotalDue').textContent = 'S/ 0.00';
            document.getElementById('paymentsTotalOverdue').textContent = 'S/ 0.00';
            document.getElementById('paymentsTotalDueToday').textContent = 'S/ 0.00';
            document.getElementById('paymentsActiveCredits').textContent = '0';
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        sales.forEach(s => {
            const balance = Number(s.balance_due || 0);
            totalDue += balance;
            activeCredits++;

            let statusStr = 'Sin fecha';
            let badgeClass = 'badge-secondary';
            let statusBadge = '<span class="badge" style="background:#f2f2f7;color:var(--text-secondary);">Sin fecha</span>';

            const dueStr = s.due_date ? new Date(s.due_date + 'T00:00:00').toLocaleDateString() : 'No definida';

            if (s.due_date) {
                const dueDate = new Date(s.due_date + 'T00:00:00');
                dueDate.setHours(0, 0, 0, 0);

                const diffTime = dueDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    statusStr = 'Vencido';
                    statusBadge = '<span class="badge badge-danger">Vencido</span>';
                    totalOverdue += balance;
                } else if (diffDays === 0) {
                    statusStr = 'Vence hoy';
                    statusBadge = '<span class="badge badge-warning">Vence hoy</span>';
                    totalDueToday += balance;
                } else {
                    statusStr = 'Por vencer';
                    statusBadge = '<span class="badge badge-primary">Por vencer</span>';
                }
            }

            const tr = document.createElement('tr');
            tr.classList.add('sale-row-clickable');
            tr.addEventListener('click', () => {
                openSaleDetailModal(s);
            });
            
            const prodName = s.product_name_snapshot || 'Producto';
            const custName = s.customer_name_snapshot || 'Cliente mostrador';
            
            const safeCust = String(custName || '');
            const safeProd = String(prodName || '');
            
            tr.innerHTML = `
                <td><strong>${safeCust}</strong></td>
                <td><span style="font-size: 13px; color: var(--text-secondary);">${safeProd}</span></td>
                <td>
                    <div style="font-size: 11px; color: var(--text-secondary);">Total: S/ ${Number(s.total || 0).toFixed(2)}</div>
                    <div style="font-weight: bold; color: var(--danger-red);">Saldo: S/ ${Number(balance || 0).toFixed(2)}</div>
                </td>
                <td>${dueStr}</td>
                <td>${statusBadge}</td>
            `;

            const tdActions = document.createElement('td');
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.gap = '8px';
            
            const btnCobrar = document.createElement('button');
            btnCobrar.textContent = 'Cobrar';
            btnCobrar.style.cssText = 'background:var(--success-green);color:white;border:none;border-radius:4px;padding:6px 12px;font-size:12px;font-weight:bold;cursor:pointer;';
            btnCobrar.addEventListener('click', (e) => {
                e.stopPropagation();
                openPaymentModal(s.id, prodName, custName, balance);
            });
            container.appendChild(btnCobrar);

            const btnVerPagos = document.createElement('button');
            btnVerPagos.textContent = 'Historial';
            btnVerPagos.style.cssText = 'background:var(--accent-blue);color:white;border:none;border-radius:4px;padding:6px 12px;font-size:12px;font-weight:bold;cursor:pointer;';
            btnVerPagos.addEventListener('click', (e) => {
                e.stopPropagation();
                openPaymentsHistoryModal(s.id, prodName, custName, s.total, balance);
            });
            container.appendChild(btnVerPagos);

            tdActions.appendChild(container);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        });

        document.getElementById('paymentsTotalDue').textContent = `S/ ${totalDue.toFixed(2)}`;
        document.getElementById('paymentsTotalOverdue').textContent = `S/ ${totalOverdue.toFixed(2)}`;
        document.getElementById('paymentsTotalDueToday').textContent = `S/ ${totalDueToday.toFixed(2)}`;
        document.getElementById('paymentsActiveCredits').textContent = activeCredits;

    } catch (err) {
        console.error('Error loading payments view:', err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--danger-red);">Error al cargar datos</td></tr>';
    }
}

async function renderCreditAlerts() {
    try {
        const { data: sales, error } = await supabaseClient
            .from('sales')
            .select('balance_due, due_date')
            .eq('sale_type', 'credito')
            .eq('is_voided', false)
            .neq('payment_status', 'pagado');

        if (error) throw error;

        let totalOverdue = 0;
        let countOverdue = 0;
        let totalDueToday = 0;
        let countDueToday = 0;
        let totalUpcoming = 0;
        let countUpcoming = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        sales?.forEach(s => {
            if (!s.due_date) return;
            const balance = Number(s.balance_due || 0);
            const dueDate = new Date(s.due_date + 'T00:00:00');
            dueDate.setHours(0, 0, 0, 0);

            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                totalOverdue += balance;
                countOverdue++;
            } else if (diffDays === 0) {
                totalDueToday += balance;
                countDueToday++;
            } else {
                totalUpcoming += balance;
                countUpcoming++;
            }
        });

        const alertOverdue = document.getElementById('alertOverdue');
        const alertDueToday = document.getElementById('alertDueToday');
        const alertUpcoming = document.getElementById('alertUpcoming');
        
        if (!alertOverdue || !alertDueToday || !alertUpcoming) return;

        if (countOverdue === 0 && countDueToday === 0 && countUpcoming === 0) {
            alertOverdue.innerHTML = '<p style="color:var(--text-secondary); font-size: 14px;">Sin alertas de crédito</p>';
            alertDueToday.innerHTML = '';
            alertUpcoming.innerHTML = '';
            return;
        }

        alertOverdue.innerHTML = countOverdue > 0 
            ? `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.06);">
                <span style="color:var(--danger-red); font-weight:bold;">🔴 ${countOverdue} vencido(s)</span>
                <span style="font-weight:bold;">S/ ${Number(totalOverdue || 0).toFixed(2)}</span>
               </div>` 
            : '';

        alertDueToday.innerHTML = countDueToday > 0 
            ? `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.06);">
                <span style="color:#FF9500; font-weight:bold;">🟠 ${countDueToday} vence(n) hoy</span>
                <span style="font-weight:bold;">S/ ${Number(totalDueToday || 0).toFixed(2)}</span>
               </div>` 
            : '';

        alertUpcoming.innerHTML = countUpcoming > 0 
            ? `<div style="display:flex; justify-content:space-between; padding:8px 0;">
                <span style="color:var(--accent-blue); font-weight:bold;">🔵 ${countUpcoming} por vencer</span>
                <span style="font-weight:bold;">S/ ${Number(totalUpcoming || 0).toFixed(2)}</span>
               </div>` 
            : '';

    } catch (err) {
        console.error('Error cargando alertas de credito:', err);
    }
}

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();

    // Si queremos navegar al dashboard solo si está logueado:
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        navigateTo('dashboardView');
        if (!localStorage.getItem('tutorial_visto')) {
            setTimeout(window.startTutorial, 800);
        }
    }
});


// --- ONBOARDING TUTORIAL ---
const tutorialSteps = [
    { target: 'button[data-target="dashboardView"]', view: 'dashboardView', title: 'Inicio', desc: 'Aquí podrás ver tus KPIs principales, alertas de stock bajo y las últimas ventas realizadas el día de hoy.' },
    { target: 'button[data-target="productsView"]', view: 'productsView', title: 'Productos', desc: 'Gestiona tu inventario. Crea nuevos productos, define precios, costos y recibe alertas.' },
    { target: 'button[data-target="salesView"]', view: 'salesView', title: 'Ventas', desc: 'Registra nuevas ventas. Selecciona productos, ajusta cantidades, igv y envíos rápidamente.' },
    { target: 'button[data-target="customersView"]', view: 'customersView', title: 'Clientes', desc: 'Administra tus clientes frecuentes, edita su información y revisa su historial de compras.' },
    { target: 'button[data-target="salesHistoryView"]', view: 'salesHistoryView', title: 'Historial', desc: 'Revisa el detalle y estado de todas las transacciones previas en un registro completo.' },
    { target: 'button[data-target="reportsView"]', view: 'reportsView', title: 'Reportes', desc: 'Analiza el rendimiento general filtrando periodos (7, 30 días o más) y monitorea utilidades neta.' },
    { target: 'button[data-target="settingsView"]', view: 'settingsView', title: 'Ajustes', desc: 'Personaliza tu experiencia y sube el logo de tu negocio.' }
];

let currentTutorialStep = 0;

window.startTutorial = function () {
    currentTutorialStep = 0;
    document.getElementById('tutorialOverlay').removeAttribute('hidden');
    renderTutorialStep();
}

function closeTutorial() {
    document.getElementById('tutorialOverlay').setAttribute('hidden', '');
    localStorage.setItem('tutorial_visto', 'true');
    const dbBtn = document.querySelector('button[data-target="dashboardView"]');
    if (dbBtn) dbBtn.click();
}

function renderTutorialStep() {
    const step = tutorialSteps[currentTutorialStep];

    // Switch view to force background routing visually
    const navBtn = document.querySelector(step.target);
    if (navBtn) navBtn.click();

    setTimeout(() => {
        const targetEl = document.querySelector(step.target);
        const spotlight = document.getElementById('tutorialSpotlight');
        const tooltip = document.getElementById('tutorialTooltip');

        if (targetEl && window.innerWidth >= 900) {
            // Desktop Spotlight calculation
            const rect = targetEl.getBoundingClientRect();
            spotlight.style.top = (rect.top - 4) + 'px';
            spotlight.style.left = (rect.left - 4) + 'px';
            spotlight.style.width = (rect.width + 8) + 'px';
            spotlight.style.height = (rect.height + 8) + 'px';
            spotlight.style.display = 'block';

            // Adjust tooltip near the menu
            let targetTop = rect.top;
            if (targetTop + 240 > window.innerHeight) {
                targetTop = window.innerHeight - 240;
            }
            tooltip.style.top = targetTop + 'px';
            tooltip.style.left = (rect.right + 24) + 'px';
            tooltip.style.transform = 'translate(0, 0)';
            tooltip.style.bottom = 'auto';
        } else {
            // Mobile handled by CSS fallback or hiding spotlight
            if (spotlight) spotlight.style.display = 'none';
        }

        document.getElementById('tutorialProgress').textContent = `${currentTutorialStep + 1} de ${tutorialSteps.length}`;
        document.getElementById('tutorialTitle').textContent = step.title;
        document.getElementById('tutorialDesc').textContent = step.desc;

        const btnNext = document.getElementById('btnTutorialNext');
        if (currentTutorialStep === tutorialSteps.length - 1) {
            btnNext.textContent = 'Finalizar';
        } else {
            btnNext.textContent = 'Siguiente';
        }

        const btnBack = document.getElementById('btnTutorialBack');
        btnBack.disabled = currentTutorialStep === 0;
        btnBack.style.opacity = currentTutorialStep === 0 ? '0.5' : '1';
    }, 150); // slight UI routing delay
}

document.getElementById('btnTutorialNext')?.addEventListener('click', () => {
    if (currentTutorialStep < tutorialSteps.length - 1) {
        currentTutorialStep++;
        renderTutorialStep();
    } else {
        closeTutorial();
    }
});

document.getElementById('btnTutorialBack')?.addEventListener('click', () => {
    if (currentTutorialStep > 0) {
        currentTutorialStep--;
        renderTutorialStep();
    }
});

document.getElementById('btnTutorialSkip')?.addEventListener('click', closeTutorial);
