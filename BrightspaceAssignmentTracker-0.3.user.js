// ==UserScript==
// @name         BrightspaceAssignmentTracker
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Collects notification data after manual click - opens links in new tabs
// @author       Jimmy Z.
// @match        https://brightspace.algonquincollege.com/d2l/home
// @grant        none
// ==/UserScript==

// issue: 1. The data has to be collected by user manual click the bell button, 
//          since there are Shadow DOM s in the Brightspace page, 
//          it would be better to have the API to collect the data.

// issue: 2. Profs always want to change the due date, after they change it, there will be a new due on item with a new date
//        in version 0.2, we didn't handle the situation, there will have more than 1 item with the same name and diff due date
//        resolve this issue in version 0.3 that we compare the item.name and item.date, 
//        if they have the same name but different date, we use the new Item to replace the old item in the cache


(function() {
    'use strict';

    const STORAGE_KEY = 'brightspace_tracker_data';
    let isCollecting = false;
    let observer = null;

    window.addEventListener('load', function() {
        const cachedData = localStorage.getItem(STORAGE_KEY);
        if (cachedData) {
            displaySummary(JSON.parse(cachedData));
        } else {
            displaySummary({ assignments: [], grades: [], feedback: [] });
        }

        observer = new MutationObserver((mutations) => {
            // The MutationObserver interface provides the ability to watch for changes being made to the DOM tree. 
            // https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
            // When we click the Bell btn, there is a list insert in the DOM, 
            // all the list items has a <a> with class: d2l-datalist-item-actioncontrol
            const notificationItems = document.querySelectorAll('.d2l-datalist-item-actioncontrol');

            if (notificationItems.length > 0 && !isCollecting) {
                isCollecting = true;
                console.log('Detected notification items, collecting data...');
                setTimeout(() => {
                    collectData();
                    observer.disconnect();
                    console.log('Observer stopped - data collection complete');
                    isCollecting = false;
                }, 500);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

    function parseDueDate(dateString) {
        // Extract date from text like "due on Sunday, September 28, 2025 11:59 PM EDT"
        const match = dateString.match(/due on (.+?)(?:\.|$)/);
        if (!match) return null;

        const dateStr = match[1].trim();
        return new Date(dateStr);
    }

    function isFuture(dateString) {
        // check if this assignment due time is in the future
        const dueDate = parseDueDate(dateString);
        if (!dueDate || isNaN(dueDate.getTime())) return true; // Keep if can't parse

        const now = new Date();
        return dueDate > now;
    }

    function collectData() {
        const cachedData = localStorage.getItem(STORAGE_KEY);
        let existingData = {
            assignments: [],
            grades: [],
            feedback: []
        };

        if (cachedData) {
            existingData = JSON.parse(cachedData);
            // Remove past assignments
            existingData.assignments = existingData.assignments.filter(item => isFuture(item.text));
        }

        const newData = {
            assignments: [...existingData.assignments],
            grades: [...existingData.grades],
            feedback: [...existingData.feedback]
        };

        const notificationLinks = document.querySelectorAll('.d2l-datalist-item-actioncontrol');

        console.log('Found links:', notificationLinks.length);

        notificationLinks.forEach(link => {
            const text = link.textContent.trim();
            const href = link.getAttribute('href');

            if (!text || !href) return;

            const container = link.closest('.d2l-datalist-item');
            let dateText = '';
            if (container) {
                const dateElement = container.querySelector('.d2l-fuzzydate, abbr');
                dateText = dateElement ? (dateElement.getAttribute('title') || dateElement.textContent.trim()) : '';
            }

            //const itemId = `${text}_${dateText}`.replace(/\s+/g, '_');
            let topic = text.match(/"([^"]+)"/);
            const itemId = topic ? topic[1] : text; // change itemId to name, the "" part, because sometimes prof will change the same assigment a new deadline

            if (text.includes('due on')) {
                // Only add future assignments
                if (isFuture(text)) {
                    const nameMatch = text.match(/"([^"]+)"/);
                    const newItem = {
                        text: text,
                        name: nameMatch ? nameMatch[1] : text,
                        date: dateText,
                        url: href.startsWith('http') ? href : `https://brightspace.algonquincollege.com${href}`,
                        id: itemId
                    };

                    // replace current assignment if the id is the same but the time is diff
                    newData = newData.assignment.map(item => (item.id === newItem.id && item.date != newItem.date) ? newItem : item)

                    // add new assignment
                    if (!newData.assignments.some(item => item.id === newItem.id)) {
                        newData.assignments.push(newItem);
                        console.log('Added assignment');
                    }
                }
            }
            else if (text.includes('Your grade is:') || (text.includes('updated') && text.includes('grade'))) {
                const newItem = {
                    text: text,
                    date: dateText,
                    url: href.startsWith('http') ? href : `https://brightspace.algonquincollege.com${href}`,
                    id: itemId
                };

                if (!newData.grades.some(item => item.id === newItem.id)) {
                    newData.grades.push(newItem);
                    // Keep only last 2 grades (FIFO)
                    if (newData.grades.length > 2) {
                        newData.grades.shift(); // Remove first (oldest)
                    }
                    console.log('Added grade');
                }
            }
            else if (text.includes('Released')) {
                const newItem = {
                    text: text,
                    date: dateText,
                    url: href.startsWith('http') ? href : `https://brightspace.algonquincollege.com${href}`,
                    id: itemId
                };

                if (!newData.feedback.some(item => item.id === newItem.id)) {
                    newData.feedback.push(newItem);
                    // Keep only last 2 feedback items (FIFO)
                    if (newData.feedback.length > 2) {
                        newData.feedback.shift(); // Remove first (oldest)
                    }
                    console.log('Added feedback');
                }
            }
        });

        console.log('Saving data...');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        console.log('Saved!');
        displaySummary(newData);
    }

    function displaySummary(data) {
        const existing = document.getElementById('assignment-grade-summary');
        if (existing) existing.remove();

        const targetContainer = document.querySelector('body > div > div.d2l-page-main.d2l-max-width.d2l-min-width > div.d2l-page-main-padding > div.d2l-homepage > div > div.homepage-row > div > div.homepage-col-8');

        if (!targetContainer) {
            console.log('Target container not found');
            return;
        }

        const summary = document.createElement('div');
        summary.id = 'assignment-grade-summary';
        summary.style.cssText = `
            background: #f6f7f8;
            border: 2px solid #006fbf;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;

        let html = '<h2 style="margin-top: 0; color: #006fbf; font-size: 18px;">Your Updates Summary</h2>';
        html += '<p style="color: #666; font-size: 12px; margin: 5px 0 15px 0;">Refresh page and click notification bell to update</p>';

        if (data.assignments.length > 0) {
            html += '<div style="margin-bottom: 15px;"><h3 style="color: #d32f2f; font-size: 16px; margin-bottom: 8px;">Assignments</h3><ul style="margin: 0; padding-left: 20px;">';
            data.assignments.forEach(item => {
                if (item.url) {
                    html += `<li style="margin-bottom: 6px;"><a href="${item.url}" target="_blank" style="color: #006fbf; text-decoration: none; font-size: 13px;">${item.text}</a></li>`;
                } else {
                    html += `<li style="margin-bottom: 6px; font-size: 13px;">${item.text}</li>`;
                }
            });
            html += '</ul></div>';
        }

        if (data.grades.length > 0) {
            html += '<div style="margin-bottom: 15px;"><h3 style="color: #2e7d32; font-size: 16px; margin-bottom: 8px;">Grades (Last 2)</h3><ul style="margin: 0; padding-left: 20px;">';
            data.grades.forEach(item => {
                if (item.url) {
                    html += `<li style="margin-bottom: 6px;"><a href="${item.url}" target="_blank" style="color: #006fbf; text-decoration: none; font-size: 13px;">${item.text}</a></li>`;
                } else {
                    html += `<li style="margin-bottom: 6px; font-size: 13px;">${item.text}</li>`;
                }
            });
            html += '</ul></div>';
        }

        if (data.feedback.length > 0) {
            html += '<div><h3 style="color: #7b1fa2; font-size: 16px; margin-bottom: 8px;">Feedback (Last 2)</h3><ul style="margin: 0; padding-left: 20px;">';
            data.feedback.forEach(item => {
                if (item.url) {
                    html += `<li style="margin-bottom: 6px;"><a href="${item.url}" target="_blank" style="color: #006fbf; text-decoration: none; font-size: 13px;">${item.text}</a></li>`;
                } else {
                    html += `<li style="margin-bottom: 6px; font-size: 13px;">${item.text}</li>`;
                }
            });
            html += '</ul></div>';
        }

        if (data.assignments.length === 0 && data.grades.length === 0 && data.feedback.length === 0) {
            html += '<p style="color: #666; font-size: 13px;">No updates found. Refresh page and click notification bell to load data.</p>';
        }

        summary.innerHTML = html;
        targetContainer.appendChild(summary);
        console.log('Display updated');
    }
})();