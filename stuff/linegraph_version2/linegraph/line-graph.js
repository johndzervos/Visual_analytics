
/**
 * Create and draw a new line-graph.
 * 
 * Arguments:
 *	 containerId => id of container to insert SVG into [REQUIRED]
 *	 
 */
function LineGraph(argsMap) {
	/* *************************************************************** */
	/* public methods */
	/* *************************************************************** */
	var self = this;
	/**
	 * This allows appending new data points to the end of the lines and sliding them within the time window:
	 * - x-axis will slide to new range
	 * - new data will be added to the end of the lines
	 * - equivalent number of data points will be removed from beginning of lines
	 * - lines will be transitioned through horizontoal slide to show progression over time
	 */
	this.slideData = function(newData) {
		// validate data
		var tempData = processDataMap(newData);
		//debug("Existing startTime: " + data.startTime + "  endTime: " + data.endTime);
		//debug("New startTime: " + tempData.startTime + "  endTime: " + tempData.endTime);
		
		// validate step is the same on each
		if(tempData.step != newData.step) {
			throw new Error("The step size on appended data must be the same as the existing data => " + data.step + " != " + tempData.step);
		}
		
		var numSteps = tempData.values[0].length;
		tempData.values.forEach(function(dataArrays, i) {
			var existingDataArrayForIndex = data.values[i];
			dataArrays.forEach(function(v) {
				// push each new value onto the existing data array
				existingDataArrayForIndex.push(v);
				// shift the front value off to compensate for what we just added
				existingDataArrayForIndex.shift();
			})
		})
		
		// shift domain by number of data elements we just added
		// == numElements * step
		data.startTime = new Date(data.startTime.getTime() + (data.step * numSteps));
		data.endTime = tempData.endTime;
		//debug("Updated startTime: " + data.startTime + "  endTime: " + data.endTime);
				
		/*
		* The following transition implementation was learned from examples at http://bost.ocks.org/mike/path/
		* In particular, view the HTML source for the last example on the page inside the tick() function.
		*/

		// redraw each of the lines
			// Transitions are turned off on this since the small steps we're taking
			// don't actually look good when animated and it uses unnecessary CPU
			// The quick-steps look cleaner, and keep the axis/line in-sync instead of jittering
		redrawAxes(false);	
		redrawLines(false);
			
	    // slide the lines left
	    graph.selectAll("g .lines path")
	        .attr("transform", "translate(-" + x(numSteps*data.step) + ")");
		 
		 handleDataUpdate();
	}
	
	/**
	 * This does a full refresh of the data:
	 * - x-axis will slide to new range
	 * - lines will change in place
	 *
	 * This is not expected to be used much if at all.
	 */
	this.updateData = function(newData) {
		// data is being replaced, not appended so we re-assign 'data'
		data = processDataMap(newData);
		// and then we rebind data.values to the lines
	    graph.selectAll("g .lines path").data(data.values)
		
		// redraw (with transition)
		redrawAxes(true);
		// transition is 'false' for lines because the transition is really weird when the data significantly changes
		// such as going from 700 points to 150 to 400
		// and because of that we rebind the data anyways which doesn't work with transitions very well at all
		redrawLines(false);
		
		 handleDataUpdate();
	}

	
	this.switchToPowerScale = function() {
		yScale = 'pow';
		redrawAxes(true);
		redrawLines(true);
	}

	this.switchToLogScale = function() {
		yScale = 'log';
		redrawAxes(true);
		redrawLines(true);
	}

	this.switchToLinearScale = function() {
		yScale = 'linear';
		redrawAxes(true);		
		redrawLines(true);
	}

	
	
	/* *************************************************************** */
	/* private variables */
	/* *************************************************************** */
	// the div we insert the graph into
	var containerId;
	var container;
	
	// functions we use to display and interact with the graphs and lines
	var graph, x, y, xAxis, yAxisLeft, yAxisLeftDomainStart, maxYscale, linesGroup, linesGroupText, lines, lineFunction;
	var yScale = 'pow'; // can be pow, log, linear
	var scales = [['linear','Linear'], ['pow','Power'], ['log','Log']];
	var hoverContainer, hoverLine, hoverLineXOffset, hoverLineYOffset, hoverLineGroup;
	
	// instance storage of data to be displayed
	var data;
		
	// define dimensions of graph
	var margin = [-1, -1, -1, -1]; // margins (top, right, bottom, left)
	var w, h;	 // width & height
	
	var transitionDuration = 500;
	
	var formatNumber = d3.format(",.0f") // for formatting integers
	var tickFormatForLogScale = function(d) { return formatNumber(d); };
	
	// used to track if the user is interacting via mouse/finger instead of trying to determine
	// by analyzing various element class names to see if they are visible or not
	var userCurrentlyInteracting = false;
	var currentUserPositionX = -1;
		
	/* *************************************************************** */
	/* initialization and validation */
	/* *************************************************************** */
	var _init = function() {
		// required variables that we'll throw an error on if we don't find
		containerId = getRequiredVar(argsMap, 'containerId');
		container = document.querySelector('#' + containerId);
		// assign instance vars from dataMap
		data = processDataMap(getRequiredVar(argsMap, 'data'));
		
		/* set the default scale */
		yScale = data.scale;

		// margins with defaults
		margin[0] = getOptionalVar(argsMap, 'marginTop', 20)
		margin[1] = getOptionalVar(argsMap, 'marginRight', 20)
		margin[2] = getOptionalVar(argsMap, 'marginBottom', 20)
		margin[3] = getOptionalVar(argsMap, 'marginLeft', 80)

		hoverLineXOffset = margin[3]+$(container).position().left;
		hoverLineYOffset = margin[0]+$(container).position().top;

		initDimensions();
		
		createGraph()
		debug("Initialization successful for container: " + containerId)	
		
		// window resize listener
		// de-dupe logic from http://stackoverflow.com/questions/667426/javascript-resize-event-firing-multiple-times-while-dragging-the-resize-handle/668185#668185
		var TO = false;
		$(window).resize(function(){
		 	if(TO !== false)
		    	clearTimeout(TO);
		 	TO = setTimeout(handleWindowResizeEvent, 200); //200 is time in miliseconds
		});
	}
	
	
	
	/* *************************************************************** */
	/* private methods */
	/* *************************************************************** */

	/*
	 * Return a validated data map
	 * 
	 * Expects a map like this:
	 *	 {"start": 1335035400000, "end": 1335294600000, "step": 300000, "values": [[28,22,45,65,34], [45,23,23,45,65]]}
	 */
	var processDataMap = function(dataMap) {
		// assign data values to plot over time
		var dataValues = getRequiredVar(dataMap, 'values', "The data object must contain a 'values' value with a data array.")
		var startTime = new Date(getRequiredVar(dataMap, 'start', "The data object must contain a 'start' value with the start time in milliseconds since epoch."))
		var endTime = new Date(getRequiredVar(dataMap, 'end', "The data object must contain an 'end' value with the end time in milliseconds since epoch."))
		var step = getRequiredVar(dataMap, 'step', "The data object must contain a 'step' value with the time in milliseconds between each data value.")		
		var names = getRequiredVar(dataMap, 'names', "The data object must contain a 'names' array with the same length as 'values' with a name for each data value array.")		
		var displayNames = getOptionalVar(dataMap, 'displayNames', names);
		var colors = getOptionalVar(dataMap, 'colors', []);
				
		/* copy the dataValues array, do NOT assign the reference otherwise we modify the original source when we shift/push data */
		var newDataValues = [];
		dataValues.forEach(function (v, i) {
			newDataValues[i] = v.slice(0);
		})
		
		if(colors.length == 0) {
			displayNames.forEach(function (v, i) {
				// set the default
				colors[i] = "black";
			})
		}
		
		return {
			"values" : newDataValues,
			"startTime" : startTime,
			"endTime" : endTime,
			"step" : step,
			"names" : names,
			"displayNames": displayNames,
			"colors": colors,
			"scale" : getOptionalVar(dataMap, 'scale', 'pow')
		}
	}
	
	var redrawAxes = function(withTransition) {
		initY();
		initX();
		
		if(withTransition) {
			// slide x-axis to updated location
			graph.selectAll("g .x.axis").transition()
			.duration(transitionDuration)
			.ease("linear")
			.call(xAxis)				  
		
			// slide y-axis to updated location
			graph.selectAll("g .y.axis").transition()
			.duration(transitionDuration)
			.ease("linear")
			.call(yAxisLeft)
		} else {
			// slide x-axis to updated location
			graph.selectAll("g .x.axis")
			.call(xAxis)				  
		
			// slide y-axis to updated location
			graph.selectAll("g .y.axis")
			.call(yAxisLeft)
		}
	}
	
	var redrawLines = function(withTransition) {
		if(withTransition) {
			graph.selectAll("g .lines path")
			.transition()
				.duration(transitionDuration)
				.ease("linear")
				.attr("d", lineFunction)
				.attr("transform", null);
		} else {
			graph.selectAll("g .lines path")
				.attr("d", lineFunction)
				.attr("transform", null);
		}
	}
	
	/*
	 * Allow re-initializing the y function at any time.
	 *  - it will properly determine what scale is being used based on last user choice (via public switchScale methods)
	 */
	var initY = function() {
		maxYscale = calculateMaxY(data)
		//debug("initY => maxYscale: " + maxYscale);
		if(yScale == 'pow') {
			y = d3.scale.pow().exponent(0.3).domain([0, maxYscale]).range([h, 0]).nice();		
		} else if(yScale == 'log') {
			y = d3.scale.log().domain([0.1, maxYscale]).range([h, 0]).nice();
		} else if(yScale == 'linear') {
			y = d3.scale.linear().domain([0, maxYscale]).range([h, 0]).nice();
		}
		
		yAxisLeft = d3.svg.axis().scale(y).ticks(6, tickFormatForLogScale).orient("left");
	}
	
	/*
	 * Whenever we add/update data we want to re-calculate if the max Y scale has changed
	 */
	var calculateMaxY = function(data) {
		// Y scale will fit values from 0-10 within pixels h-0 (Note the inverted domain for the y-scale: bigger is up!)
			// we get the max of the max of values for the given index since we expect an array of arrays
		var maxY = d3.max(data.values, function(d) { return d3.max(d); });
		//debug("calculateMaxY => " + maxY);
		return maxY;
	}
	
	/*
	 * Allow re-initializing the x function at any time.
	 */
	var initX = function() {
		// X scale starts at epoch time 1335035400000, ends at 1335294600000 with 300s increments
		x = d3.time.scale().domain([data.startTime, data.endTime]).range([0, w]);
		
		// create yAxis (with ticks)
		xAxis = d3.svg.axis().scale(x).tickSize(-h).tickSubdivide(1);
			// without ticks
			//xAxis = d3.svg.axis().scale(x);
	}

	/**
	* Creates the SVG elements and displays the line graph.
	*
	* Expects to be called once during instance initialization.
	*/
	var createGraph = function() {
		
		// Add an SVG element with the desired dimensions and margin.
		graph = d3.select("#" + containerId).append("svg:svg")
				.attr("width", w + margin[1] + margin[3])
				.attr("height", h + margin[0] + margin[2])	
				.append("svg:g")
					.attr("transform", "translate(" + margin[3] + "," + margin[0] + ")");
				
		initX()

		// Add the x-axis.
		graph.append("svg:g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + h + ")")
			.call(xAxis);
		
		// y is all done in initY because we need to re-assign vars quite often to change scales
		initY();
		
		// Add the y-axis to the left
		graph.append("svg:g")
			.attr("class", "y axis")
			.attr("transform", "translate(-10,0)")
			.call(yAxisLeft);
				
		// create line function used to plot our data
		lineFunction = d3.svg.line()
			// assign the X function to plot our line as we wish
			.x(function(d,i) { 
				/* 
				 * Our x value is defined by time and since our data doesn't have per-metric timestamps
				 * we calculate time as (startTime + the step between metrics * the index)
				 *
 				 * We also reach out to the persisted 'data' object for time
 				 * since the 'd' passed in here is one of the children, not the parent object
				 */
				var _x = x(data.startTime.getTime() + (data.step*i)); 
				// verbose logging to show what's actually being done
				//debug("Line X => index: " + i + " scale: " + _x)
				// return the X coordinate where we want to plot this datapoint
				return _x;
			})
			.y(function(d) { 
				var _y = y(d); 
				// verbose logging to show what's actually being done
				//debug("Line Y => data: " + d + " scale: " + _y)
				// return the Y coordinate where we want to plot this datapoint
				return _y;
			});

		// append a group to contain all lines
		lines = graph.append("svg:g")
				.attr("class", "lines")
			.selectAll("path")
				.data(data.values); // bind the array of arrays

		// persist this reference so we don't do the selector every mouse event
		hoverContainer = container.querySelector('g .lines');
		
		
		$(container).mouseleave(function(event) {
			handleMouseOutGraph(event);
		})
		
		$(container).mousemove(function(event) {
			handleMouseOverGraph(event);
		})		

					
		// add a line group for each array of values (it will iterate the array of arrays bound to the data function above)
		linesGroup = lines.enter().append("g")
				.attr("class", function(d, i) {
					return "line_group series_" + i;
				});
				
		// add path (the actual line) to line group
		linesGroup.append("path")
				.attr("class", function(d, i) {
					debug("Appending line [" + containerId + "]: " + i)
					return "line series_" + i;
				})
				.attr("fill", "none")
				.attr("stroke", function(d, i) {
					return data.colors[i];
				})
				.attr("d", lineFunction) // use the 'lineFunction' to create the data points in the correct x,y axis
				.on('mouseover', function(d, i) {
					handleMouseOverLine(d, i);
				});
				
		// add line label to line group
		linesGroupText = linesGroup.append("svg:text");
		linesGroupText.attr("class", function(d, i) {
				debug("Appending line [" + containerId + "]: " + i)
				return "line_label series_" + i;
			})
			.text(function(d, i) {
				return "";
			});
			
		// add a 'hover' line that we'll show as a user moves their mouse (or finger)
		// so we can use it to show detailed values of each line
		hoverLineGroup = graph.append("svg:g")
							.attr("class", "hover-line");
		// add the line to the group
		hoverLine = hoverLineGroup
			.append("svg:line")
				.attr("x1", 10).attr("x2", 10) // vertical line so same value on each
				.attr("y1", 0).attr("y2", h); // top to bottom	
				
		// hide it by default
		hoverLine.classed("hide", true);
				
		createLegend();		
		createScaleButtons();
		createDateLabel();
		
		setValueLabelsToLatest();
	}
	
	/**
	 * Create a legend that displays the name of each line with appropriate color coding
	 * and allows for showing the current value when doing a mouseOver
	 */
	var createLegend = function() {
		
		// append a group to contain all lines
		var legendLabelGroup = graph.append("svg:g")
				.attr("class", "legend-group")
			.selectAll("g")
				.data(data.displayNames)
			.enter().append("g")
				.attr("class", "legend-labels");
				
			/*
			* If there is some better way to flow svg:text elements together I'd love to know it
			* but until I find that I'm using mutable vars to record and calculate the correct position
			* of each text element so they get dynamically spaced according to their length
			*/
		var cumulativeWidth = 0;
		var labelLocations = [];
		legendLabelGroup.append("svg:text")
				.attr("class", "legend name")
				.text(function(d, i) {
					return d;
				})
				.attr("font-size", "12") // this must be before "x" which dynamically determines width
				.attr("fill", function(d, i) {
					return data.colors[i];
				})
				.attr("x", function(d, i) {
					// return it at the width of previous labels (where the last one ends)
					var returnX = cumulativeWidth;
					// increment cumulative to include this one
					cumulativeWidth += this.clientWidth+5;
					return returnX;
				})
				.attr("y", -4)
				
		// put in placeholders with 0 width that we'll populate and resize dynamically
		legendLabelGroup.append("svg:text")
				.attr("class", "legend value hide")
				.attr("font-size", "12")
				.attr("fill", function(d, i) {
					return data.colors[i];
				})
				.attr("y", -4)
				
	}
	
	/**
	 * Create scale buttons for switching the y-axis
	 */
	var createScaleButtons = function() {
		var cumulativeWidth = 0;		
		// append a group to contain all lines
		var buttonGroup = graph.append("svg:g")
				.attr("class", "scale-button-group")
			.selectAll("g")
				.data(scales)
			.enter().append("g")
				.attr("class", "scale-buttons")
			.append("svg:text")
				.attr("class", "scale-button")
				.text(function(d, i) {
					return d[1];
				})
				.attr("font-size", "12") // this must be before "x" which dynamically determines width
				.attr("fill", function(d) {
					if(d[0] == yScale) {
						return "black";
					} else {
						return "blue";
					}
				})
				.classed("selected", function(d) {
					if(d[0] == yScale) {
						return true;
					} else {
						return false;
					}
				})
				.attr("x", function(d, i) {
					// return it at the width of previous labels (where the last one ends)
					var returnX = cumulativeWidth;
					// increment cumulative to include this one
					cumulativeWidth += this.clientWidth+5;
					return returnX;
				})
				.attr("y", -4)
				.on('click', function(d, i) {
					handleMouseClickScaleButton(this, d, i);
				});
	}

	var handleMouseClickScaleButton = function(button, buttonData, index) {
		if(index == 0) {
			self.switchToLinearScale();
		} else if(index == 1) {
			self.switchToPowerScale();
		} else if(index == 2) {
			self.switchToLogScale();
		}
		
		// change text decoration
		graph.selectAll('.scale-button')
		.attr("fill", function(d) {
			if(d[0] == yScale) {
				return "black";
			} else {
				return "blue";
			}
		})
		.classed("selected", function(d) {
			if(d[0] == yScale) {
				return true;
			} else {
				return false;
			}
		})
		
	}
	
	/**
	 * Create a data label
	 */
	var createDateLabel = function() {
		// append a group
		var buttonGroup = graph.append("svg:g")
				.attr("class", "date-label-group")
			.append("svg:text")
				.attr("class", "date-label")
				.attr("font-size", "10") // this must be before "x" which dynamically determines width
				.attr("y", -4)
				.attr("text-anchor", "end")
	}

	
	/**
	 * Called when a user mouses over a line.
	 */
	var handleMouseOverLine = function(lineData, index) {
		//debug("MouseOver line [" + containerId + "] => " + index)
		
		// user is interacting
		userCurrentlyInteracting = true;
	}

	/**
	 * Called when a user mouses over the graph.
	 */
	var handleMouseOverGraph = function(event) {	
		var mouseX = event.clientX-hoverLineXOffset;
		var mouseY = event.clientY-hoverLineYOffset;
		
		//debug("MouseOver graph [" + containerId + "] => x: " + mouseX + " y: " + mouseY)
		if(mouseX >= 0 && mouseX <= w && mouseY >= 0 && mouseY <= h) {
			// show the hover line
			hoverLine.classed("hide", false);

			// set position of hoverLine
			hoverLine.attr("x1", mouseX).attr("x2", mouseX)
			
			displayValueLabelsForPositionX(mouseX)
			
			// user is interacting
			userCurrentlyInteracting = true;
			currentUserPositionX = mouseX;
		} else {
			// proactively act as if we've left the area since we're out of the bounds we want
			handleMouseOutGraph(event)
		}
	}
	
	
	var handleMouseOutGraph = function(event) {	
		// hide the hover-line
		hoverLine.classed("hide", true);
		
		setValueLabelsToLatest();
		
		//debug("MouseOut graph [" + containerId + "] => " + mouseX + ", " + mouseY)
		
		// user is no longer interacting
		userCurrentlyInteracting = false;
		currentUserPositionX = -1;
	}
	
	/*
	* Handler for when data is updated.
	*/
	var handleDataUpdate = function() {
		if(userCurrentlyInteracting) {
			// user is interacting, so let's update values to wherever the mouse/finger is on the updated data
			if(currentUserPositionX > -1) {
				displayValueLabelsForPositionX(currentUserPositionX)
			}
		} else {
			// the user is not interacting with the graph, so we'll update the labels to the latest
			setValueLabelsToLatest();
		}
	}
	
	/**
	* Display the data values at position X in the legend value labels.
	*/
	var displayValueLabelsForPositionX = function(xPosition) {
		var labelValueWidths = [];
		graph.selectAll("text.legend.value")
		.text(function(d, i) {
			return getValueForPositionXFromData(xPosition, data.values[i]).value;
		})
		.attr("x", function(d, i) {
			labelValueWidths[i] = this.clientWidth;
		})
		
		// position label names
		var cumulativeWidth = 0;
		var labelNameEnd = [];
		graph.selectAll("text.legend.name")
				.attr("x", function(d, i) {
					// return it at the width of previous labels (where the last one ends)
					var returnX = cumulativeWidth;
					// increment cumulative to include this one + the value label at this index
					cumulativeWidth += this.clientWidth+4+labelValueWidths[i]+8;
					// store where this ends
					labelNameEnd[i] = returnX + this.clientWidth+5;
					return returnX;
				})

		// position label values
		graph.selectAll("text.legend.value")
		.attr("x", function(d, i) {
			return labelNameEnd[i];
		})
		
		// show the date
		var date = x.invert(xPosition);
		graph.select('text.date-label').text(date.toDateString() + " " + date.toLocaleTimeString())

		// show the legend labels
		graph.selectAll("text.legend.value")
			.classed("hide", false)

		// move the group of labels to the right side
		graph.selectAll("g.legend-group g").attr("transform", "translate(" + (w-cumulativeWidth) +",0)")
		
		// move the date to the left of that group
		graph.select('text.date-label').attr("x", (w-cumulativeWidth-10))
	}
	
	
	/**
	* Set the value labels to whatever the latest data point is.
	*/
	var setValueLabelsToLatest = function() {
		displayValueLabelsForPositionX(w);
	}
	
	/**
	* Convert back from an X position on the graph to a data value from the given array (one of the lines)
	* Return {value: value, date, date}
	*/
	var getValueForPositionXFromData = function(xPosition, d) {
		// get the date on x-axis for the current location
		var xValue = x.invert(xPosition);

		// Calculate the value from this date by determining the 'index'
		// within the data array that applies to this value
		var index = (xValue.getTime() - data.startTime) / data.step;
		if(index >= d.length) {
			index = d.length-1;
		}
		// The date we're given is interpolated so we have to round off to get the nearest
		// index in the data array for the xValue we're given.
		// Once we have the index, we then retrieve the data from the d[] array
		var v = d[Math.round(index)];
		// since we've already calculated it, let's use it here and also set the text value
		return {value: Math.round(v), date: xValue};
	}

	
	/**
	 * Called when the window is resized to redraw graph accordingly.
	 */
	var handleWindowResizeEvent = function() {
	 	debug("Window Resize Event [" + containerId + "] => resizing graph")
	 	initDimensions();
		initX();
		
		// reset width/height of SVG
		d3.select("#" + containerId + " svg")
				.attr("width", w + margin[1] + margin[3])
				.attr("height", h + margin[0] + margin[2]);

		// reset transform of x axis
		graph.selectAll("g .x.axis")
			.attr("transform", "translate(0," + h + ")");

		redrawAxes(true);
		redrawLines(true);
	}

	/**
	 * Set height/width dimensions based on container.
	 */
	var initDimensions = function() {
		// automatically size to the container using JQuery to get width/height
		w = $("#" + containerId).width() - margin[1] - margin[3]; // width
		h = $("#" + containerId).height() - margin[0] - margin[2]; // height
	}
	
	/**
	* Return the value from argsMap for key or throw error if no value found
	*/	  
	var getRequiredVar = function(argsMap, key, message) {
		if(!argsMap[key]) {
			if(!message) {
				throw new Error(key + " is required")
			} else {
				throw new Error(message)
			}
		} else {
			return argsMap[key]
		}
	}
	
	/**
	* Return the value from argsMap for key or defaultValue if no value found
	*/
	var getOptionalVar = function(argsMap, key, defaultValue) {
		if(!argsMap[key]) {
			return defaultValue
		} else {
			return argsMap[key]
		}
	}
	
	var error = function(message) {
		console.log("ERROR: " + message)
	}

	var debug = function(message) {
		console.log("DEBUG: " + message)
	}
	
	/* *************************************************************** */
	/* execute init now that everything is defined */
	/* *************************************************************** */
	_init();
};

			
