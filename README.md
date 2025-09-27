# Brightspace Assignment Tracker

This is a javascript code for display the assignment information in the Brightspace home page: https://brightspace.algonquincollege.com/d2l/home

We already have those data, we can check the information by click the right up corner Bell:

![Data in page](img/c2.png "Data in page")

It is better to display the due soon item in the page for remind like this:

![Final output](img/c1.png)


## Tampermonkey

It is using [Tampermonkey](https://chromewebstore.google.com/detail/dhdgffkkebhmkfjojejmpbldmpobfkfo?utm_source=item-share-cb) to help manage the script deployment. We can check the Tampermonkey detail in the website: https://www.tampermonkey.net/  
  
When we have some data in the page, but not satisfy the way they displaying, we can change it by inject javascript to change the page view.  
  
The most important concept of Tampermonkey, it will injects script to the page.  
And the timing to execute can be control, when we are using:  
```
window.addEventListener('load', function() { ... });
```
This waits for the load event, which fires when:  

✅ All HTML is parsed  
✅ All images, stylesheets, scripts are downloaded  
✅ Page is fully rendered  
  
A full timeline visualization:  
1. Page starts loading  
2. HTML DOM ready
3. [Tampermonkey injects script by default]
4. Images/CSS still loading...
5. window 'load' event fires ← YOUR CODE RUNS HERE
6. Everything complete

https://www.tampermonkey.net/documentation.php?locale=en  

If we want to build Tampermonnkey code, we need to analysis the page html first.  


## Known issue
The data has to be load by manually click the right up corner Bell button, since there are some "Shadow DOM" which cannot been catched by javascript in the page.

## function
1. We only display the coming up due item, passed due items will not show in the data.
2. We only display two last Grades and Feed back items.
3. The data was saved in the explorer localStorage.
4. The script only been tested in Chrome env.