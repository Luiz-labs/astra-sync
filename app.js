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
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isLoggedIn = !!session;
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
    tbody.innerHTML = '';

    let products = [];

    try {
        products = await fetchProductsFromSupabase();
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
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

    // Aplicar búsqueda sobre lista limpia
    const filtered = uniqueProducts.filter(p =>
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
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
            ? p.supplier
            : '<span style="color:var(--text-secondary);font-style:italic;">N/A</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.name}</td>
            <td>${p.category || 'General'}</td>
            <td>${proveedorVisual}</td>
            <td>S/ ${Number(p.cost).toFixed(2)}</td>
            <td>S/ ${Number(p.sale_price).toFixed(2)}</td>
            <td>${margin}%</td>
            <td>
                <span style="color: ${p.stock <= 5 ? 'var(--danger-red)' : 'inherit'}; font-weight: ${p.stock <= 5 ? 'bold' : 'normal'}">
                    ${p.stock}
                </span>
            </td>
            <td>
                <button onclick="editProduct('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--accent-blue);font-size:16px;">✏️</button>
                <button onclick="deleteProduct('${p.id}')" style="background:none;border:none;cursor:pointer;color:var(--danger-red);font-size:16px;margin-left:8px;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('searchProducts')?.addEventListener('input', (e) => {
    renderProducts(e.target.value);
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

    let profile;
    try {
        profile = await getCurrentProfile();
    } catch (error) {
        showToast('Error de usuario', '❌');
        return;
    }

    const payload = { tenant_id: profile.tenant_id, name, phone, email };
    let error;

    if (idInput) {
        const res = await supabaseClient.from('customers').update({ name, phone, email }).eq('id', idInput);
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
    document.getElementById('customerPhone').value = c.phone;
    document.getElementById('customerEmail').value = c.email;
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
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">
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
            <td style="display: flex; gap: 8px;">
                <button onclick="editCustomer('${c.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 13px;">Editar</button>
                <button onclick="deleteCustomer('${c.id}')" class="btn-secondary" style="padding: 6px 12px; font-size: 13px; color: var(--danger-red); border-color: rgba(255, 69, 58, 0.2);">X</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}


// --- VENTAS ---
const newSaleForm = document.getElementById('newSaleForm');
const saleSelectProduct = document.getElementById('saleSelectProduct');
const saleSelectCustomer = document.getElementById('saleSelectCustomer');
const saleQuantity = document.getElementById('saleQuantity');
const saleTotalAmount = document.getElementById('saleTotalAmount');
const saleProfitAmount = document.getElementById('saleProfitAmount');

async function loadSalesForm() {
    let products = [];
    let customers = [];
    try {
        products = await fetchProductsFromSupabase();
        customers = await fetchCustomersFromSupabase();
    } catch (e) { }

    saleSelectProduct.innerHTML = '<option value="" disabled selected>-- Seleccionar Producto --</option>';
    products.forEach(p => {
        if (p.stock > 0) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.dataset.price = p.sale_price;
            opt.dataset.cost = p.cost;
            opt.dataset.stock = p.stock;
            opt.textContent = `${p.name} - S/ ${p.sale_price} (Stock: ${p.stock})`;
            saleSelectProduct.appendChild(opt);
        }
    });

    saleSelectCustomer.innerHTML = '<option value="">Cliente mostrador</option>';
    customers.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        saleSelectCustomer.appendChild(opt);
    });

    saleQuantity.value = 1;
    calculateSaleTotals();
}

function calculateSaleTotals() {
    const selectedOpt = saleSelectProduct.options[saleSelectProduct.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) {
        saleTotalAmount.textContent = '0.00';
        saleProfitAmount.textContent = '0.00';
        return;
    }

    const price = parseFloat(selectedOpt.dataset.price);
    const cost = parseFloat(selectedOpt.dataset.cost);
    const maxStock = parseInt(selectedOpt.dataset.stock);

    let qty = parseInt(saleQuantity.value) || 1;
    if (qty > maxStock) {
        qty = maxStock;
        saleQuantity.value = maxStock;
    }

    const total = qty * price;
    const profit = qty * (price - cost);

    saleTotalAmount.textContent = total.toFixed(2);
    saleProfitAmount.textContent = profit.toFixed(2);
}

saleSelectProduct.addEventListener('change', calculateSaleTotals);
saleQuantity.addEventListener('input', calculateSaleTotals);

newSaleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedOpt = saleSelectProduct.options[saleSelectProduct.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) return;

    const qty = parseInt(saleQuantity.value);
    const productId = selectedOpt.value;
    const productName = selectedOpt.text.split(' -')[0];

    const availableStock = parseInt(selectedOpt.dataset.stock);
    if (qty > availableStock) {
        showToast(`Stock insuficiente. Máximo disponible: ${availableStock}`, '❌');
        return;
    }

    let customerId = saleSelectCustomer.value || null;
    let customerName = "Cliente mostrador";
    if (customerId) {
        customerName = saleSelectCustomer.options[saleSelectCustomer.selectedIndex].text;
    }

    let profile;
    try { profile = await getCurrentProfile(); } catch (e) { return showToast('Error perfil', '❌'); }

    const unitPrice = parseFloat(selectedOpt.dataset.price || '0');
    const unitCost = parseFloat(selectedOpt.dataset.cost || '0');

    const salePayload = {
        tenant_id: String(profile.tenant_id),
        product_id: productId,
        customer_id: customerId,
        product_name_snapshot: productName,
        customer_name_snapshot: customerName,
        quantity: qty,
        unit_price: unitPrice,
        unit_cost: unitCost,
        total: qty * unitPrice,
        profit: qty * (unitPrice - unitCost),
        created_by: profile.id,
        is_voided: false
    };

    const { error: saleErr } = await supabaseClient
        .from('sales')
        .insert(salePayload);

    if (saleErr) {
        console.error('ERROR REAL AL GUARDAR VENTA:', saleErr);
        return showToast(`Error venta: ${saleErr.message}`, '❌');
    }

    await supabaseClient.from('products').update({ stock: availableStock - qty }).eq('id', productId);

    showToast('¡Venta Completada exitosamente!');
    newSaleForm.reset();
    await loadSalesForm();
    await updateDashboard();
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
}

async function updateReports() {
    const timeframe = document.getElementById('reportTimeframe').value;
    let sales = [];
    try { sales = await fetchSalesFromSupabase(); } catch (e) { }

    const now = new Date();
    let filteredSales = sales;

    if (timeframe !== 'all') {
        const days = parseInt(timeframe);
        const cutoffTime = now.getTime() - (days * 24 * 60 * 60 * 1000);
        filteredSales = sales.filter(s => new Date(s.created_at).getTime() >= cutoffTime && !s.is_voided);
    } else {
        filteredSales = sales.filter(s => !s.is_voided);
    }

    const totalSales = filteredSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const totalProfit = filteredSales.reduce((sum, s) => sum + Number(s.profit || 0), 0);

    document.getElementById('reportTotalSales').textContent = 'S/ ' + totalSales.toFixed(2);
    document.getElementById('reportTotalProfit').textContent = 'S/ ' + totalProfit.toFixed(2);
}

document.getElementById('reportTimeframe').addEventListener('change', updateReports);

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
        const statusBadge = isVoided
            ? '<span style="color:var(--danger-red); font-size:12px; font-weight:bold;">Anulada</span>'
            : '<span style="color:var(--success-green); font-size:12px; font-weight:bold;">Activa</span>';

        const actionBtn = isVoided
            ? '<span style="color:var(--text-secondary); font-size:12px;">N/A</span>'
            : `<button onclick="deleteSale('${s.id}', '${s.product_id}', ${s.quantity})" style="background:none;border:none;cursor:pointer;color:var(--danger-red);font-size:16px;">🗑️</button>`;

        const tr = document.createElement('tr');
        if (rowStyle) tr.style.cssText = rowStyle;
        tr.innerHTML = `
            <td>${formattedDate}</td>
            <td><strong>${s.product_name_snapshot}</strong></td>
            <td>${s.quantity}</td>
            <td>${s.customer_name_snapshot || 'Cliente mostrador'}</td>
            <td><strong>S/ ${s.total.toFixed(2)}</strong></td>
            <td style="color: var(--success-green);">S/ ${s.profit.toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
        `;
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

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();

    // Si queremos navegar al dashboard solo si está logueado:
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        navigateTo('dashboardView');
    }
});
