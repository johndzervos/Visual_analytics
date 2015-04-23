var r = 600,

format = d3.format(",d"),

fill = d3.scale.category20c();

//var

 NA=["United States","Mexico","Canada","Guatemala","Cuba","Dominican Republic","Haiti","Honduras","El Salvador","Nicaragua","Costa Rica","Puerto Rico","Panama","Jamaica","Trinidad","Tobago","Bahamas","Barbados","Beliza","Saint Lucia","Grenada","Dominica","Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinios","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New jersey","New mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginina","Wisconsin","Wyoming"];


//var

 EU=["Russia","France","Ukraine","Spain","Sweden","Norway","Germany","Finland","Poland","Italy","United Kingdom","Romania","Belarus","Kazakhstan","Greece","Bulgaria","Iceland","Hungary","Portugal","Serbia","Austria","Czech Republic","Republic of Ireland","Georgia","Lithuania","Latvia","Croatia","Bosnia","Herzegovina","Slovakia","Estonia","Denmark","Netherlands","Switzerland","Moldova","Belgium","Albania","Macedonia","Turkey","Slovenia","Montenegro","Azerbaijan","Luxembourg","Andorra","Malta","Leichtenstein","San Marino","Monaco","Vatican City"];




var gg="Christian rock"
var countUS=0;

var bubble = d3.layout.pack()
			   .sort(null)
			   .size([r, r]);

var vis = d3.select("#chart").append("svg")
			.attr("width", 600)
			.attr("height", 600)
			.attr("class", "bubble");

d3.json("datanew.json", function(json) {
	var node = vis.selectAll("g.node")
		.data(bubble.nodes(classes(json))
		.filter(function(d) { return !d.children; }))
		.enter().append("g")
		.attr("class", "node")
		.attr("transform", function(d) { return "translate(" +d.x+ ","  +d.y+  ")";} );

	node.append("title")
		.text(function(d) { return d.slocation + ": " + format(d.value); });

	node.append("circle")
		.attr("r", function(d) { return d.r;})
		.style("fill", function(d) {return fill(d.slocation);});


	node.append("text")
		.attr("text-anchor", "middle")
		.attr("dy", "0em")
		.text(function(d) { return d.slocation; });

	
});


function classes(root) 
{
	var classes = [];
	var x;
	function recurse(name, node) 
	{
		if (node.children)
		{
			node.children.forEach(function(child) {recurse(node.name, child); });
		}
		else if (x=parseInt(node.year)==yyyy && node.genre==gg)
		{
			countUS++;
			classes.push({sgenre: node.genre, slocation: node.location, value: node.count});
		}

	}

	recurse(null, root);
	return {children: classes};
}
