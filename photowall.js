var PhotoWall = Class.create({
	rows: 2,
	columns: 3,
	photos: {},
	photo_queue: [],
	photo_display_time: 8000,
	update_count: 0,

	initialize: function( container ) {
		this.container = container
		this.photo_sources = $A( arguments ).splice( 1 )
		this.drawGrid()
		this.populatePhotos()
		setInterval( this.updateWall.bind(this), this.photo_display_time )
	},

	loadScript: function( src, onload, async ) {
		var script_el = document.createElement('script'); script_el.type = 'text/javascript'; //script_el.async = async === undefined ? true : async;
		script_el.src = src;
		script_el.onload = onload
		var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(script_el, s);
	},

	drawGrid: function() {
		for ( var i = 0; i < this.rows; i++ ) {
			var row_el = new Element( 'div', { style: 'height:'+(100/this.rows)+'%;', 'class': 'photowall_row' } )
			$(this.container).insert( row_el )
			for ( var j = 0; j < this.columns; j++ ) {
				var n = (i*this.columns) + j
				row_el.insert(
					new Element( 'div', { style: 'width:'+(100/this.columns)+'%;', 'class': 'photowall_column' } ).update(
						new Element( 'div', { 'class': 'photowall_photo_container' } ).update(
							new Element( 'div', { 'class': 'photowall_photo', id: 'photowall_photo' + n } )
						)
					)
				)
			}
		}
	},

	updateWall: function() {
		var update_photos = []
		return function() {
			if ( !update_photos.length )
				for ( var i = 0; i < this.rows*this.columns; i++ )
					update_photos.push( i )

			var i = Math.floor( Math.random()*update_photos.length )
			var i = update_photos.splice( i, 1 )[0]
			var el = $('photowall_photo'+i)
			el.photo = this.replacePhoto( el.photo )
			if ( el.photo )
				el.setStyle({ 'background-image': 'url('+el.photo.image_url+')' })
		}
	}(),

	replacePhoto: function( photo ) {
		if ( this.photo_queue.length && ( !photo || new Date() - photo.visible_since > this.photo_display_time ) ) {
			if ( photo ) photo.visible = false
			var photo = this.photo_queue.splice(0,1)[0]
			if ( photo ) {
				this.photo_queue.push( photo )
				photo.viewed++
				photo.visible = true
				photo.visible_since = new Date()
			}
		}
		return photo
	},

	addPhoto: function( image_url, data ) {
		console.log( image_url )
		if ( !this.photos[image_url] ) {
			this.photos[image_url] = {
				loaded: false,
				viewed: 0,
				visible: false,
				image_url: image_url,
				added: new Date(),
				data: data
			}

			Event.observe( new Element( 'img', { src: image_url }), 'load', function() {
				this.photos[image_url].loaded = true
				this.photo_queue.splice( 0, 0, this.photos[image_url] )
			}.bind(this) )
		}
	},

	populatePhotos: function() {
		for ( var i = 0; i < this.photo_sources.length; i++ )
			this.photo_sources[i].start( this )
	},

})

PhotoWall.Twitter = (function() {
	var photo_sources = [ 'pic.twitter.com', 'instagr.am', 'twitpic.com' ]

	var n_requests = 0
	var request_interval = 24*1000

	var processTweet = function( tweet ) {
		if ( tweet.entities ) {
			if ( tweet.entities.media )
				for ( var j = 0; j < tweet.entities.media.length; j++ )
					this.photowall.addPhoto( tweet.entities.media[j].media_url )
			else if ( tweet.entities.urls )
				for ( var j = 0; j < tweet.entities.urls.length; j++ ) {
					var url
					if ( tweet.entities.urls[j].display_url.substr(0,12) == 'twitpic.com/' )
						url = 'http://twitpic.com/show/full/' + tweet.entities.urls[j].display_url.substr(12) + '.jpg'
					else if ( tweet.entities.urls[j].display_url.substr(0,13) == 'instagr.am/p/' )
						url = tweet.entities.urls[j].expanded_url + 'media/?size=l'
					this.photowall.addPhoto( url, tweet )
				}
		}
	}

	return {
		Search: Class.create({
			url: 'http://search.twitter.com/search.json',
			params: {
				lang:'en',
				include_entities:true,
				q: null,
				rpp:null,
				callback:null,
				page:1
			},

			initialize: function() {
				this.queries = $A( arguments )
				n_requests += this.queries.length + photo_sources.length
			},

			start: function( photowall ) {
				this.photowall = photowall
				this.rpp = this.photowall.rows*this.photowall.columns
				rand = Math.floor(Math.random()*1000000)
				this.params.callback = 'photowall_twittersearchcallback_'+rand
				window[this.params.callback] = this.processResults.bind( this )
				this.gatherPhotos()
				setInterval( this.gatherPhotos.bind( this ), n_requests*request_interval )
			},

			gatherPhotos: function() {
				for ( var i = 0; i < photo_sources.length; i++ ) {
					for ( var j = 0; j < this.queries.length; j++ ) {
						this.params.q = photo_sources[i] + ' ' + this.queries[j]
						this.photowall.loadScript( this.url + '?' + Object.toQueryString( this.params ) )
					}
				}
				this.params.q = null
			},

			processResults: function( search ) {
				for ( var i = 0; i < search.results.length; i++ )
					processTweet.bind(this)( search.results[i] )
			}
		}),

		User: Class.create({
			url: 'http://api.twitter.com/1/statuses/user_timeline.json',
			params: {
				lang:'en',
				include_entities:true,
				screen_name: null,
				rpp:null,
				callback:null,
				page:1
			},


			initialize: function() {
				this.screen_names = $A( arguments )
				n_requests += this.screen_names.length + photo_sources.length
			},

			start: function( photowall ) {
				this.photowall = photowall
				this.rpp = this.photowall.rows*this.photowall.columns
				rand = Math.floor(Math.random()*1000000)
				this.params.callback = 'photowall_twitterusercallback_'+rand
				window[this.params.callback] = this.processResults.bind( this )
				this.gatherPhotos()
				setInterval( this.gatherPhotos.bind( this ), n_requests*request_interval )
			},

			gatherPhotos: function() {
				for ( var i = 0; i < photo_sources.length; i++ ) {
					for ( var j = 0; j < this.screen_names.length; j++ ) {
						this.params.screen_name = this.screen_names[j]
						this.photowall.loadScript( this.url + '?' + Object.toQueryString( this.params ) )
					}
				}
				this.params.screen_name = null
			},

			processResults: function( results ) {
				for ( var i = 0; i < results.length; i++ )
					processTweet.bind(this)( results[i] )
			}
		})
	}
})();

PhotoWall.StaticPhotos = Class.create({
	initialize: function() {
		this.photos = $A( arguments )
	},

	start: function( photowall ) {
		this.photowall = photowall
		for ( var i = 0; i < this.photos.length; i++ )
			this.photowall.addPhoto( this.photos[i], {} )
	}
})
