var Gab={
	connection:null,
	
    jid_to_id: function (jid) {
        return Strophe.getBareJidFromJid(jid)
            .replace("@", "-")
            .replace(".", "-");
    },

    on_roster: function (iq) {
        $(iq).find('item').each(function () {
            var jid = $(this).attr('jid');
            var name = $(this).attr('name') || jid;

            // transform jid into an id
            var jid_id = Gab.jid_to_id(jid);

            var contact = $("<li id='" + jid_id + "'>" +
                            "<div class='roster-contact offline'>" +
                            "<div class='roster-name'>" +
                            name +
                            "</li>");

            Gab.insert_contact(contact);
        });

        // set up presence handler and send initial presence
        Gab.connection.addHandler(Gab.on_presence, null, "presence");
        Gab.connection.send($pres());
    },
    
    pending_subscriber: null,
    
    on_presence: function (presence) {
        var ptype = $(presence).attr('type');
        var from = $(presence).attr('from');
        var jid_id = Gab.jid_to_id(from);

        if (ptype === 'subscribe') {
            // populate pending_subscriber, the approve-jid span, and
            // open the dialog
            Gab.pending_subscriber = from;
            $('#approve-jid').text(Strophe.getBareJidFromJid(from));
            $('#approve_dialog').dialog('open');
        } else if (ptype !== 'error') {
            var contact = $('#roster-area li#' + jid_id + ' .roster-contact')
                .removeClass("online")
                .removeClass("away")
                .removeClass("offline");
            if (ptype === 'unavailable') {
                contact.addClass("offline");
            } else {
                var show = $(presence).find("show").text();
                if (show === "" || show === "chat") {
                    contact.addClass("online");
                } else {
                    contact.addClass("away");
                }
            }

            var li = contact.parent();
            li.remove();
            Gab.insert_contact(li);
        }

        // reset addressing for user since their presence changed
        var jid_id = Gab.jid_to_id(from);
        $('#chat-' + jid_id).data('jid', Strophe.getBareJidFromJid(from));

        return true;
    },
    
    on_roster_changed: function (iq) {
        $(iq).find('item').each(function () {
            var sub = $(this).attr('subscription');
            var jid = $(this).attr('jid');
            var name = $(this).attr('name') || jid;
            var jid_id = Gab.jid_to_id(jid);

            if (sub === 'remove') {
                // contact is being removed
                $('#' + jid_id).remove();
            } else {
                // contact is being added or modified
                var contact_html = "<li id='" + jid_id + "'>" +
                    "<div class='" + 
                    ($('#' + jid_id).attr('class') || "roster-contact offline") +
                    "'>" +
                    "<div class='roster-name'>" +
                    name +
                    "</div><div class='roster-jid'>" +
                    jid +
                    "</div></div></li>";

                if ($('#' + jid_id).length > 0) {
                    $('#' + jid_id).replaceWith(contact_html);
                } else {
                    Gab.insert_contact(contact_html);
                }
            }
        });

        return true;
    },
    
    on_message: function (message) {
        var full_jid = $(message).attr('from');
        var jid = Strophe.getBareJidFromJid(full_jid);
        var jid_id = Gab.jid_to_id(jid);

        if ($('#chat-' + jid_id).length === 0) {
            $('#chat-area').tabs('add', '#chat-' + jid_id, jid);
            $('#chat-' + jid_id).append(
                "<div class='chat-messages'></div>" +
                "<input type='text' class='chat-input'>");
        }
        
        $('#chat-' + jid_id).data('jid', full_jid);

        $('#chat-area').tabs('select', '#chat-' + jid_id);
        $('#chat-' + jid_id + ' input').focus();

        var composing = $(message).find('composing');
        if (composing.length > 0) {
            $('#chat-' + jid_id + ' .chat-messages').append(
                "<div class='chat-event'>" +
                Strophe.getNodeFromJid(jid) +
                " is typing...</div>");

            Gab.scroll_chat(jid_id);
        }

        var body = $(message).find("html > body");

        if (body.length === 0) {
            body = $(message).find('body');
            if (body.length > 0) {
                body = body.text()
            } else {
                body = null;
            }
        } else {
            body = body.contents();

            var span = $("<span></span>");
            body.each(function () {
                if (document.importNode) {
                    $(document.importNode(this, true)).appendTo(span);
                } else {
                    // IE workaround
                    span.append(this.xml);
                }
            });

            body = span;
        }

        if (body) {
            // remove notifications since user is now active
            $('#chat-' + jid_id + ' .chat-event').remove();

            // add the new message
            $('#chat-' + jid_id + ' .chat-messages').append(
                "<div class='chat-message'>" +
                "&lt;<span class='chat-name'>" +
                Strophe.getNodeFromJid(jid) +
                "</span>&gt;<span class='chat-text'>" +
                "</span></div>");

            $('#chat-' + jid_id + ' .chat-message:last .chat-text')
                .append(body);

            Gab.scroll_chat(jid_id);
        }

        return true;
    },  
    
    scroll_chat: function (jid_id) {
        var div = $('#chat-' + jid_id + ' .chat-messages').get(0);
        div.scrollTop = div.scrollHeight;
    },


    presence_value: function (elem) {
        if (elem.hasClass('online')) {
            return 2;
        } else if (elem.hasClass('away')) {
            return 1;
        }

        return 0;
    },

    insert_contact: function (elem) {
		$('#roster_area ul').append(elem);
    }    
}





$(document).ready(function(){

	$('#login_btn').click(function(){
		$(document).trigger('connect', {
			jid: $('#jid').val(),
			password: $('#password').val()
		});
	});	
	
	$('#add_contact_btn').click(function(){
		$(document).trigger('contact_added', {
			jid: $('#contact_jid').val(),
			password: $('#contact_name').val()
		});
	});		
	
	
    $('#approve_dialog').dialog({
        autoOpen: false,
        draggable: false,
        modal: true,
        title: 'Subscription Request',
        buttons: {
            "Deny": function () {
                Gab.connection.send($pres({
                    to: Gab.pending_subscriber,
                    "type": "unsubscribed"}));
                Gab.pending_subscriber = null;

                $(this).dialog('close');
            },

            "Approve": function () {
                Gab.connection.send($pres({
                    to: Gab.pending_subscriber,
                    "type": "subscribed"}));

                Gab.connection.send($pres({
                    to: Gab.pending_subscriber,
                    "type": "subscribe"}));
                
                Gab.pending_subscriber = null;

                $(this).dialog('close');
            }
        }
    });

})

$(document).bind('connect', function (ev, data) {
    var conn = new Strophe.Connection(
        "http://42.96.145.160:5280/http-bind");

    conn.xmlInput = function (body) {
        Peek.show_traffic(body, 'incoming');
    };

    conn.xmlOutput = function (body) {
        Peek.show_traffic(body, 'outgoing');
    };

    conn.connect(data.jid, data.password, function (status) {
        if (status === Strophe.Status.CONNECTED) {
            $(document).trigger('connected');
        } else if (status === Strophe.Status.DISCONNECTED) {
            $(document).trigger('disconnected');
        }
    });

    Gab.connection = conn;
    Peek.connection = conn;//add this
});

$(document).bind('connected', function () {
    var iq = $iq({type: 'get'}).c('query', {xmlns: 'jabber:iq:roster'});
    Gab.connection.sendIQ(iq, Gab.on_roster);

    Gab.connection.addHandler(Gab.on_roster_changed,
                              "jabber:iq:roster", "iq", "set");

    Gab.connection.addHandler(Gab.on_message,
                              null, "message", "chat");
});

$(document).bind('disconnected', function () {
    Gab.connection = null;
    Gab.pending_subscriber = null;
});

$(document).bind('contact_added', function (ev, data) {
    var iq = $iq({type: "set"}).c("query", {xmlns: "jabber:iq:roster"})
        .c("item", data);
    Gab.connection.sendIQ(iq);
    
    var subscribe = $pres({to: data.jid, "type": "subscribe"});
    Gab.connection.send(subscribe);
});







