# Astra Sync - UI Design & Implementation Plan

## 1. Overall Aesthetic (Apple UI / CleanMyMac Inspired)
The goal is to create a premium, native-feeling application using purely web technologies. 
*   **Colors**: 
    *   *Background*: `#F5F5F7` (Apple's signature light gray for backgrounds)
    *   *Cards/Surfaces*: `#FFFFFF` with a very subtle, soft shadow (`box-shadow: 0 4px 24px rgba(0,0,0,0.04)`)
    *   *Primary Text*: `#1D1D1F`
    *   *Secondary Text*: `#86868B`
    *   *Accents*: `#007AFF` (Action Blue), `#34C759` (Success/Stock Green), `#FF3B30` (Alert Red)
*   **Typography**: The system font stack will be used (`-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`) to ensure it looks perfectly native on Apple devices.
*   **Shapes**: Soft rounded corners for cards (`border-radius: 16px`) and buttons (`border-radius: 8px` or pill-shaped `99px`).
*   **Motion**: Smooth, 0.2s ease-in-out transitions for hover states, button presses, and modal appearances.

## 2. Layout Structure & Navigation
*   **Mobile-First Approach (iPhone)**: 
    *   A bottom tab navigation bar for mobile devices, or a clean, hidden side-menu.
    *   Full-width cards with comfortable padding (16px - 20px).
*   **Desktop/Tablet Scaling**: 
    *   The bottom nav seamlessly transitions into a sleek left-hand sidebar on larger screens.
    *   Content expands into a masonry or simple grid layout.

## 3. Views & Core Functionality (Phase 1)
All views will live in a single HTML file with sections toggled via vanilla JavaScript, keeping it extremely light.

*   **Dashboard**:
    *   *Top Cards*: "Today's Sales", "Low Stock Alerts", "Total Customers".
    *   *Recent Activity*: A clean list showing the latest 5 transactions.
*   **Products (Inventory)**:
    *   A searchable, scrollable list of products showing: Name, SKU, Stock Level (with a red/green indicator), Cost, and Suggested Price.
    *   A modal overlay (glassmorphism background) for "Add/Edit Product" to input product details.
*   **Sales (Point of Sale)**:
    *   A clean form to register a new sale.
    *   *Flow*: Select a customer (optional) -> Search/Select Product -> Input Quantity -> See Total -> Click "Complete Sale".
    *   *Action*: Automatically deducts from the product's stock count.
*   **Customers**:
    *   A simple directory of saved customers (Name, Phone, Email).
*   **Reports**:
    *   Minimalist tables/bar graphs (drawn using basic HTML/CSS) showing sales.

## 4. Data Architecture (localStorage)
Data will be structured in clean JSON arrays and stored locally.
*   `astra_stock`: `[{ id, name, cost, suggested_price, stock_level }]`
*   `astra_sales`: `[{ id, date, customer_id, items: [...], total }]`
*   `astra_clients`: `[{ id, name, phone, email }]`

## 5. Development Steps Checklist
- [x] Step 1: UI Design Plan (Currently Reviewing)
- [ ] Step 2: HTML Structure (Semantic tags, basic layout, sections)
- [ ] Step 3: CSS Styling (Defining CSS variables for colors, layout grids, Apple-style UI classes)
- [ ] Step 4: JavaScript Logic (Routing between tabs, localStorage CRUD operations, populating DOM elements)
- [ ] Step 5: Final Polish (Adding subtle animations, testing mobile responsiveness)
