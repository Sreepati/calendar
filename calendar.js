// OAuth Client ID can be retrieved from your project in the Google Developer Console, https://console.developers.google.com. 
// See : https://developers.google.com/google-apps/calendar/quickstart/js#prerequisites
// For Calendar app browser key : see : http://fullcalendar.io/docs/google_calendar/

"use strict";
var GOOGLE_APP_BROWSER_KEY = '';
var GOOGLE_OAUTH_CLIENT_ID = '';
var SCOPES = ["https://www.googleapis.com/auth/calendar","https://www.googleapis.com/auth/plus.me"];
// google calendar section start
	/*** Use a button to handle authentication the first time.
	load google apis ***/
    function handleClientLoad() { 
      gapi.client.setApiKey(GOOGLE_APP_BROWSER_KEY); 
      window.setTimeout(checkAuth,1); 
    }
	
	/*** immediate check for app authorization for actions ***/
    function checkAuth() { 
      gapi.auth.authorize({client_id: GOOGLE_OAUTH_CLIENT_ID, scope: SCOPES, immediate: true}, handleAuthResult); 
    }
	
	/*** if not authorized then ask for authorization using the below button ***/
    function handleAuthResult(authResult) {
        var authorizeButton = document.getElementById('authorize-button');
        var authorizeDiv = document.getElementById('authorize-div');
        if (authResult && !authResult.error) {
		/*** successfully authorized ***/
		authorizeButton.style.visibility = 'hidden';
		authorizeDiv.style.display = 'block';
		makeApiCall();
        } else {
		/*** authorized failed. try auth again ***/
		authorizeButton.style.visibility = '';
		authorizeDiv.style.display = 'block';
		authorizeButton.onclick = handleAuthClick;
        }
    }
	
	/*** lazy check for app authorization for actions ***/
    function handleAuthClick(event) { 
      gapi.auth.authorize({client_id: GOOGLE_OAUTH_CLIENT_ID, scope: SCOPES, immediate: false}, handleAuthResult); 
      return false; 
    }
	
    /*** after authorization get user details. As our system does not have google user login, we are managing user check for multiple account. ***/ 
    function makeApiCall() { 
      gapi.client.load('plus', 'v1', function() { 
        var request = gapi.client.plus.people.get({ 'userId': 'me'	}); 
        request.execute(function(resp) {
	        /*** save / validate user details for local authentication ***/
	        $.getJSON(baseUrl+'<Some URL>', {value: resp}, function(response){
	          ( response.success ) ? loadCalendarApi(response.calendar) : handleAuthError( resp, response );	
	        }); 
	      });	
	   }); 
	 }
	
	/*** handle authorization issues such as wrong account login and no calendar id for new user etc. ***/
	function handleAuthError(resp, response){ 
	  if( response.type == 'authentication' ){ 	
	    alert(response.error); 
	  } else if ( response.type == 'account' ){ 
	    if(confirm(response.error) == true){ 
	      saveNewAccount(resp); 
	    } else { 
	      alert('You have cancelled the process.'); 
	    } 
	  } 
	}

	/*** if new user then save the user details for reauthorization on later logins. ***/
	function saveNewAccount(resp){ 
	  $.getJSON(baseUrl+'<Some URL>', {value: resp}, function(response){ 
	    loadCalendarApi(response.calendar); 
	  }); 
	}

	/*** after all authorization related issues solved, load the calendar apis ***/
	function loadCalendarApi(calendar) {
		var authorizeDiv = document.getElementById('authorize-div');
		authorizeDiv.style.display = 'none';
		localStorage.setItem('calendar-details',JSON.stringify(calendar));  
		localStorage.setItem('calendarId',JSON.stringify(calendar[0].details));
		if(!calendar || !calendar[0].details.calendar_id ){
			gapi.client.load('calendar', 'v3', handleCalendarList);
		} else {
			gapi.client.load('calendar', 'v3',loadCalendar);
		}
	}

	/*** find and save primary calendar id for easy sync. although not needed. keep value in database in case user has multiple calendars and want to sync with particular calendar. ***/
	function handleCalendarList(){ 
	  var request = gapi.client.calendar.calendarList.list(); 
	  request.execute(function(resp){ 
	    var calendars = resp.items; 
	    $.each( calendars, function( key, value ) { 
	      if( value.primary && value.primary == true ){
	        localStorage.setItem('primary-calendar',JSON.stringify(value)); 
	        $.getJSON(baseUrl+'<Some URL>', 
	          {user: localStorage.getItem('calendar-details'), value: value}, function(response){
	            localStorage.setItem('calendarId',JSON.stringify(response.calendar)); 
	            window.location.reload(); 
	        }); 
	       } 
	     }); 
	   }); 
	 }

	/*** all methods completed. now can proceed to view / insert data into google calendar. ***/
	function loadCalendar(){ 
	  var cal_det = JSON.parse(localStorage.getItem('calendarId')); 
	  var CALENDAR_ID = cal_det.calendar_id; 
	  var calendar = $('#calendar'); 
	  var source = { googleCalendarId: CALENDAR_ID, className: 'gcal-event1', color: '#000' } ; 
	  calendar.fullCalendar( 'addEventSource', source ); 
	}
// google calendar section end

// Display section start
$(document).ready(function() {	
	var currentLangCode = 'en';
	$('#calendar').fullCalendar({
		header: {
			left: 'prev,next today',
			center: 'title',
			right: 'month,agendaWeek,agendaDay'
		},
		lang: currentLangCode,
		googleCalendarApiKey: GOOGLE_APP_BROWSER_KEY,
		buttonIcons: false, /*** show the prev/next text ***/
		weekNumbers: true, /*** show week count in side bar ***/
		weekNumberCalculation: 'ISO', /*** see below comment ***/
		/*** displayEventTime: false, /*** disable event time ***/
		firstDay: 1, /*** see below comment ***/
		editable: false, /*** limit drag/drop functionality. ***/
		eventLimit: true, /*** allow "more" link when too many events ***/
		events: function(start, end, timezone, callback) {
			var moment = $('#calendar').fullCalendar('getDate');
			$.ajax({
				url: baseUrl+'<Some URL>',
				dataType: 'json',
				data: {	month: moment.format('M') , year: moment.format('YYYY') },
				success: function(doc) {
					var events = [];
					$(doc).each(function() {
						events.push({
							title: $(this).attr('title'),
							start: $(this).attr('start'),
							end: $(this).attr('end'),
							color: $(this).attr('color'),
							appointment_id: $(this).attr('appointment_id')
						});
					});
				callback(events);
				}
			});
		},
		eventClick: function(event) {
			if( typeof event.source.googleCalendarId != 'undefined' && event.source.googleCalendarId.length > 0 ){
				window.open(event.url, '_blank');
				return false;
			}
			var div = $('#event-popup > div');
			if( div.length == 0 || $(div).attr('for') != event.appointment_id ){
				$("#event-popup").html('');
				/*** opens events in a popup window ***/
				$( "#event-popup" ).load( baseUrl+'<Some URL>'+event.appointment_id, function() {
					$('.login--popup-cont-tblpop').fadeIn(); 
					$('.login-reg-form-tblpop').addClass('fadein'); 
					$('body').addClass('popup-open');
				});
			} else {
				$('.login--popup-cont-tblpop').fadeIn();
				$('.login-reg-form-tblpop').addClass('fadein'); 
				$('body').addClass('popup-open');
			}
			return false;
		}
	});
	$(document).on('click','.close--popup',function(){
		$('.login--popup-cont-tblpop').fadeOut(function(){
			$('body').removeClass('popup-open'); 
			$('.login-reg-form-tblpop').css('display','');
		});
		$('.login-reg-form-tblpop').removeClass('fadein');
		
		$('.google--popup-cont').fadeOut(function(){
			$('body').removeClass('popup-open'); 
			$('.google-reg-form').css('display','');
		});
		$('.login-reg-form-tblpop').removeClass('fadein');		
	});
	$(document).on('click','.google--popup',function(){
		$('.google--popup-cont').fadeIn();
		$('.google-reg-form').addClass('fadein'); 
		$('body').addClass('popup-open');
	});
});
/*** MySQl consider 2016-01-01 as week 53, same for PHP. In fullCalendar, define weekNumberCalculation: 'ISO' and firstDay: 1 to get accurate value else full calendar considers 2016-01-01 as week 52.  ***/
// Display section end

// Google Calendar Insert event start
function handleInsert(id, event){
	var cal_det = JSON.parse(localStorage.getItem('calendarId'));
	var CALENDAR_ID = cal_det.calendar_id;
	var request = gapi.client.calendar.events.insert({
		'calendarId': CALENDAR_ID,
		'resource': event
	});		
	request.execute(function(gres) {
		console.log('Event created: ' + gres.htmlLink);
		$.getJSON(baseUrl+'<Some URL>', {id: id, value: gres}, function(response){
			console.log(response);
		});
	});
}
// Google calendar insert event end
function syncAppointment(){
	var form = $("#google-sync"); 
	var submiturl = $(form).attr('action'); 
	form.find('.has-error').remove(); 
	$.post( submiturl, form.serialize(), function(response) {
		if(!response.message){
			var j = 0, l = response.length;
			$.each( response, function( key, value ) { 
				handleInsert(key,value);
			});
		} else {
			alert(response.message);
		}
	}, "json").done(function() {
		console.log( "Success." );
	}).fail(function() {	
		console.log( "Some error occured. Please try after some time." );
	}).always(function() {	
		console.log( "Completed." );
		window.location.reload();
	});
}

// personal appointment section start
function personalAppointment(){
	var form = $("#AppointmentAgendaForm"); var submiturl = $(form).attr('action');
	$.post( submiturl, form.serialize(), function(response) {
		console.log(response);
		if (response.success) {
			console.log(response.success);
			alert(response.success);
			setTimeout(function(){ location = baseUrl+response.redirect; }, 3000);
		} else {
			if( response.error.description ) {
				form.find('textarea[name="data[Appointment][description]"]').after('<p class="has-error">'+response.error.description+'</p>');
			}
			if( response.error.filter_start ) {
				form.find('input[name="data[Appointment][filter_start]"]').after('<p class="has-error">'+response.error.filter_start+'</p>');
			}
			if( response.error.filter_end ) {
				form.find('input[name="data[Appointment][filter_end]"]').after('<p class="has-error">'+response.error.filter_end+'</p>');
			}
			if( response.error.appoint_start_time ) {
				form.find('select[name="data[Appointment][appoint_start_time]"]').after('<p class="has-error">'+response.error.appoint_start_time+'</p>');
			}
			if( response.error.appoint_end_time ) {
				form.find('select[name="data[Appointment][appoint_end_time]"]').after('<p class="has-error">'+response.error.appoint_end_time+'</p>');
			}
		}
	}, "json").done(function() {
		console.log( "Success." );
		setTimeout(function(){ $(form).find('p.has-error').remove(); }, 3000);
	}).fail(function() {
		console.log( "Some error occured. Please try after some time." );
	}).always(function() {
		console.log( "Completed." );
	});
}
// personal appointment section end
