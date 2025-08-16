// Capital Choice Platform - Enhanced DOM Utilities with Checkbox Support

const DOM = {
    // Get element by ID
    get(id) {
        return document.getElementById(id);
    },
    
    // Query selector
    query(selector) {
        return document.querySelector(selector);
    },
    
    // Query selector all
    queryAll(selector) {
        return document.querySelectorAll(selector);
    },
    
    // Create element
    create(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('data-')) {
                element.dataset[key.substring(5)] = value;
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.substring(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Add children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    },
    
    // Show element
    show(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.style.display = '';
            element.classList.remove('d-none');
        }
    },
    
    // Hide element
    hide(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.style.display = 'none';
        }
    },
    
    // Toggle visibility
    toggle(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            if (element.style.display === 'none' || element.classList.contains('d-none')) {
                this.show(element);
            } else {
                this.hide(element);
            }
        }
    },
    
    // Add class
    addClass(elementOrId, className) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            if (className.includes(' ')) {
                element.classList.add(...className.split(' '));
            } else {
                element.classList.add(className);
            }
        }
    },
    
    // Remove class
    removeClass(elementOrId, className) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            if (className.includes(' ')) {
                element.classList.remove(...className.split(' '));
            } else {
                element.classList.remove(className);
            }
        }
    },
    
    // Toggle class
    toggleClass(elementOrId, className) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.classList.toggle(className);
        }
    },
    
    // Has class
    hasClass(elementOrId, className) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        return element ? element.classList.contains(className) : false;
    },
    
    // Set text content
    setText(elementOrId, text) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.textContent = text;
        }
    },
    
    // Set HTML content
    setHTML(elementOrId, html) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.innerHTML = html;
        }
    },
    
    // Get value
    getValue(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        return element ? element.value : '';
    },
    
    // Set value
    setValue(elementOrId, value) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.value = value;
        }
    },
    
    // NEW: Check if checkbox/radio is checked
    isChecked(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element && (element.type === 'checkbox' || element.type === 'radio')) {
            return element.checked;
        }
        return false;
    },
    
    // NEW: Set checkbox/radio checked state
    setChecked(elementOrId, checked = true) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element && (element.type === 'checkbox' || element.type === 'radio')) {
            element.checked = checked;
        }
    },
    
    // NEW: Toggle checkbox state
    toggleChecked(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element && (element.type === 'checkbox' || element.type === 'radio')) {
            element.checked = !element.checked;
            return element.checked;
        }
        return false;
    },
    
    // NEW: Check if element is disabled
    isDisabled(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        return element ? element.disabled : false;
    },
    
    // NEW: Set disabled state
    setDisabled(elementOrId, disabled = true) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.disabled = disabled;
        }
    },
    
    // NEW: Focus element
    focus(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element && typeof element.focus === 'function') {
            element.focus();
        }
    },
    
    // NEW: Blur element
    blur(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element && typeof element.blur === 'function') {
            element.blur();
        }
    },
    
    // Get attribute
    getAttribute(elementOrId, attribute) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        return element ? element.getAttribute(attribute) : null;
    },
    
    // Set attribute
    setAttribute(elementOrId, attribute, value) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.setAttribute(attribute, value);
        }
    },
    
    // Remove attribute
    removeAttribute(elementOrId, attribute) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.removeAttribute(attribute);
        }
    },
    
    // Add event listener
    on(elementOrId, event, handler, options = false) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.addEventListener(event, handler, options);
        }
    },
    
    // Remove event listener
    off(elementOrId, event, handler, options = false) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.removeEventListener(event, handler, options);
        }
    },
    
    // Trigger event
    trigger(elementOrId, event, detail = {}) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            const customEvent = new CustomEvent(event, { detail, bubbles: true });
            element.dispatchEvent(customEvent);
        }
    },
    
    // Append child
    append(parentOrId, child) {
        const parent = typeof parentOrId === 'string' ? this.get(parentOrId) : parentOrId;
        if (parent) {
            if (typeof child === 'string') {
                parent.insertAdjacentHTML('beforeend', child);
            } else {
                parent.appendChild(child);
            }
        }
    },
    
    // Prepend child
    prepend(parentOrId, child) {
        const parent = typeof parentOrId === 'string' ? this.get(parentOrId) : parentOrId;
        if (parent) {
            if (typeof child === 'string') {
                parent.insertAdjacentHTML('afterbegin', child);
            } else {
                parent.insertBefore(child, parent.firstChild);
            }
        }
    },
    
    // Remove element
    remove(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }
    },
    
    // Clear element content
    clear(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.innerHTML = '';
        }
    },
    
    // Check if element exists
    exists(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        return element !== null && element !== undefined;
    },
    
    // NEW: Get form data as object
    getFormData(formOrId) {
        const form = typeof formOrId === 'string' ? this.get(formOrId) : formOrId;
        if (!form) return {};
        
        const formData = new FormData(form);
        const data = {};
        
        for (const [key, value] of formData.entries()) {
            // Handle multiple values (like checkboxes with same name)
            if (data[key]) {
                if (Array.isArray(data[key])) {
                    data[key].push(value);
                } else {
                    data[key] = [data[key], value];
                }
            } else {
                data[key] = value;
            }
        }
        
        return data;
    },

    // Debounce method
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // NEW: Set form data from object
    setFormData(formOrId, data) {
        const form = typeof formOrId === 'string' ? this.get(formOrId) : formOrId;
        if (!form || !data) return;
        
        Object.entries(data).forEach(([key, value]) => {
            const elements = form.querySelectorAll(`[name="${key}"]`);
            
            elements.forEach(element => {
                if (element.type === 'checkbox' || element.type === 'radio') {
                    if (Array.isArray(value)) {
                        element.checked = value.includes(element.value);
                    } else {
                        element.checked = element.value === value || value === true;
                    }
                } else {
                    element.value = value;
                }
            });
        });
    }
};

// Make DOM utility available globally
window.DOM = DOM;