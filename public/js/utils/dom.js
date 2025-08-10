// Capital Choice Platform - DOM Utilities

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
    
    // Empty element
    empty(elementOrId) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.innerHTML = '';
        }
    },
    
    // Find parent
    findParent(element, selector) {
        let parent = element.parentElement;
        while (parent) {
            if (parent.matches(selector)) {
                return parent;
            }
            parent = parent.parentElement;
        }
        return null;
    },
    
    // Find closest
    closest(elementOrId, selector) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        return element ? element.closest(selector) : null;
    },
    
    // Animate element
    animate(elementOrId, keyframes, options = {}) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element && element.animate) {
            return element.animate(keyframes, options);
        }
    },
    
    // Fade in
    fadeIn(elementOrId, duration = 300) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.style.opacity = '0';
            element.style.display = '';
            
            this.animate(element, [
                { opacity: '0' },
                { opacity: '1' }
            ], { duration, fill: 'forwards' });
        }
    },
    
    // Fade out
    fadeOut(elementOrId, duration = 300) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            const animation = this.animate(element, [
                { opacity: '1' },
                { opacity: '0' }
            ], { duration, fill: 'forwards' });
            
            if (animation) {
                animation.onfinish = () => {
                    element.style.display = 'none';
                };
            }
        }
    },
    
    // Slide down
    slideDown(elementOrId, duration = 300) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.style.overflow = 'hidden';
            const height = element.scrollHeight;
            
            this.animate(element, [
                { height: '0px' },
                { height: `${height}px` }
            ], { duration, fill: 'forwards' });
        }
    },
    
    // Slide up
    slideUp(elementOrId, duration = 300) {
        const element = typeof elementOrId === 'string' ? this.get(elementOrId) : elementOrId;
        if (element) {
            element.style.overflow = 'hidden';
            const height = element.scrollHeight;
            
            const animation = this.animate(element, [
                { height: `${height}px` },
                { height: '0px' }
            ], { duration, fill: 'forwards' });
            
            if (animation) {
                animation.onfinish = () => {
                    element.style.display = 'none';
                };
            }
        }
    },
    
    // Debounce
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
    
    // Throttle
    throttle(func, limit = 300) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Ready
    ready(fn) {
        if (document.readyState !== 'loading') {
            fn();
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    }
};