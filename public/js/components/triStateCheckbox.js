// Tri-State Checkbox Component
const TriStateCheckbox = {
    // Define the options for each category
    categories: {
        scope: {
            title: 'Scope',
            options: [
                'Receive', 'Assemble', 'Deliver', 'Install', 
                'Furniture Removal', 'Bring Items to Capital Choice', 
                'Move', 'Punch-List', 'Trash Removal'
            ]
        },
        site_info: {
            title: 'Site Information',
            options: [
                'Dock Access', 'Ground Floor', 'Passenger Elevator', 
                'Freight Elevator', 'Stair Carry', 'Tight Doorways', 
                'Tight Hallways', 'Assemble On-Site', 'Limited/No Loading Zone'
            ]
        },
        requirements: {
            title: 'Requirements',
            options: [
                'COI', 'Site Training', 'Badge Access', 
                'After Hours', 'Weekend', 'Regular Hours'
            ]
        }
    },

    // Create the tri-state checkbox HTML
    createCheckbox(category, option, value = null) {
        const id = `${category}_${option.replace(/[\s\/\-]/g, '_')}`;
        const displayName = option;
        
        return `
            <div class="tri-state-checkbox-item" data-category="${category}" data-option="${option}">
                <div class="tri-state-wrapper">
                    <input type="hidden" 
                           name="${category}_options[${option}]" 
                           id="${id}_value" 
                           value="${value || ''}"
                           class="tri-state-value">
                    
                    <div class="tri-state-control" 
                         onclick="TriStateCheckbox.toggle('${id}')"
                         id="${id}_control">
                        <span class="tri-state-icon ${this.getStateClass(value)}" 
                              id="${id}_icon">
                            ${this.getStateIcon(value)}
                        </span>
                        <span class="tri-state-label">${displayName}</span>
                    </div>
                </div>
            </div>
        `;
    },

    // Get the appropriate icon for the state
    getStateIcon(value) {
        switch(value) {
            case 'check': return '<i class="fas fa-check"></i>';
            case 'x': return '<i class="fas fa-times"></i>';
            default: return '<i class="fas fa-minus"></i>';
        }
    },

    // Get the CSS class for the state
    getStateClass(value) {
        switch(value) {
            case 'check': return 'state-check';
            case 'x': return 'state-x';
            default: return 'state-blank';
        }
    },

    // Toggle through states: blank -> check -> x -> blank
    toggle(id) {
        const valueInput = document.getElementById(`${id}_value`);
        const icon = document.getElementById(`${id}_icon`);
        
        let currentValue = valueInput.value;
        let newValue;
        
        // Cycle through states
        switch(currentValue) {
            case '':
            case null:
                newValue = 'check';
                break;
            case 'check':
                newValue = 'x';
                break;
            case 'x':
                newValue = '';
                break;
            default:
                newValue = 'check';
        }
        
        // Update the hidden input
        valueInput.value = newValue;
        
        // Update the visual state
        icon.className = `tri-state-icon ${this.getStateClass(newValue)}`;
        icon.innerHTML = this.getStateIcon(newValue);
    },

    // Render a complete category section
    renderCategory(categoryKey, existingValues = {}) {
        const category = this.categories[categoryKey];
        if (!category) return '';
        
        return `
            <div class="tri-state-category" id="${categoryKey}_category">
                <h5 class="category-title">
                    <i class="fas fa-caret-right category-toggle" 
                       onclick="TriStateCheckbox.toggleCategory('${categoryKey}')"></i>
                    ${category.title}
                </h5>
                <div class="tri-state-options" id="${categoryKey}_options">
                    <div class="row">
                        ${category.options.map(option => `
                            <div class="col-md-6 col-lg-4 mb-2">
                                ${this.createCheckbox(categoryKey, option, existingValues[option])}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    // Toggle category expansion
    toggleCategory(categoryKey) {
        const options = document.getElementById(`${categoryKey}_options`);
        const toggle = document.querySelector(`#${categoryKey}_category .category-toggle`);
        
        if (options.style.display === 'none') {
            options.style.display = 'block';
            toggle.classList.remove('fa-caret-right');
            toggle.classList.add('fa-caret-down');
        } else {
            options.style.display = 'none';
            toggle.classList.remove('fa-caret-down');
            toggle.classList.add('fa-caret-right');
        }
    },

    // Parse values from form data
    parseFormValues(formData, category) {
        const values = {};
        const prefix = `${category}_options[`;
        
        for (const [key, value] of formData.entries()) {
            if (key.startsWith(prefix) && value) {
                const option = key.substring(prefix.length, key.length - 1);
                values[option] = value;
            }
        }
        
        return values;
    },

    // Display options in project detail view
    displayOptions(categoryKey, options) {
        if (!options || Object.keys(options).length === 0) {
            return '';
        }
        
        const category = this.categories[categoryKey];
        const checkedItems = [];
        const xItems = [];
        
        // Separate checked and X items
        Object.entries(options).forEach(([option, value]) => {
            if (value === 'check') {
                checkedItems.push(option);
            } else if (value === 'x') {
                xItems.push(option);
            }
        });
        
        if (checkedItems.length === 0 && xItems.length === 0) {
            return '';
        }
        
        return `
            <div class="option-display-section">
                <h5>${category.title}</h5>
                <div class="option-badges">
                    ${checkedItems.map(item => `
                        <span class="option-badge badge-check">
                            <i class="fas fa-check"></i> ${item}
                        </span>
                    `).join('')}
                    ${xItems.map(item => `
                        <span class="option-badge badge-x">
                            <i class="fas fa-times"></i> ${item}
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    }
};

// Make it globally available
window.TriStateCheckbox = TriStateCheckbox;