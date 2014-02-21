var models = require('../models');

exports.login = function(req, res) {
    console.log(req.query.name);
    if (!req.query.name) {
        res.render('login');
        return;
    }
    req.session.username = req.query.name;
    res.redirect('/');
};

exports.logout = function(req, res) {
    req.session.username = '';
    res.redirect('/login');
};

exports.home = function(req, res) {
    if (!req.session.username)
        res.redirect('/login');

    var high = new Date();
    var low = new Date();
    low.setDate(high.getDate() - 5);
    low.setHours(0);
    low.setMinutes(0);
    low.setSeconds(0);
    models.Record
        .find({
            'user': req.session.username,
            'from': {$lt: high, $gte: low}
        })
        .exec(function(err, records) {
            var lists = populateRecords(records, low, high);
            res.render('home', {
                user: {
                    name: req.session.username
                },
                items: lists,
                from: req.query.from
            });
        });
};

function pad(i) {
    return i < 10 ? '0'+i : i;
}

function normalizeDate(date) {
    return [date.getFullYear(), date.getMonth()+1, date.getDate()].map(pad).join('-');
}

function normalizeTime(date) {
    var hour = date.getHours();
    var ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour === 0 ? 12 : hour;
    return [hour, date.getMinutes()+1].map(pad).join(':') + ampm;
}

function populateRecords(records, low, high) {
    var num_records = records.length;
    var dates = {};

    for (var d = low; d < high; d.setDate(d.getDate() + 1)) {
        dates[d] = [];
    }

    for (var i = 0; i < num_records; i++) {
        var record = records[i];
        // use date at 00:00:00 as key
        var from = new Date(record.from);
        from.setHours(0);
        from.setMinutes(0);
        from.setSeconds(0);

        dates[from].push({
            id: record._id,
            name: record.task,
            start: normalizeTime(record.from),
            end: normalizeTime(record.to)
        });
    }

    var lists = [];

    for (var date in dates) {
        lists.push({
            date: normalizeDate(new Date(date)),
            events: dates[date]
        });
    }

    lists.sort(function(a, b) {
        return new Date(a.date) < new Date(b.date);
    });

    return lists;
}

exports.nav = function(req, res) {
    res.render('nav');
};

exports.statistics = function(req, res) {
    res.render('statistics');
};

exports.calendar = function(req, res) {
  res.render('calendar');
};

exports.record = function(req, res) {
    var is_mobile = /mobile/i.test(req.header('user-agent'));
    res.render('record', {
        is_mobile: is_mobile
    });
};

// convert to YY/DD/YYYY HH:MM
function datetimePickerFormat(date) {
    var d = [date.getMonth()+1, date.getDate(), date.getFullYear()].map(pad).join('/');
    var t = [date.getHours(), date.getMinutes()].map(pad).join(':');
    return d + ' ' + t;
}

exports.edit = function(req, res) {
    var is_mobile = /mobile/i.test(req.header('user-agent'));
    var id = req.params.id;
    var back_url = req.get('Referer');

    if (!back_url)
        back_url = '/';

    // TODO: remove hack
    var lidx = back_url.lastIndexOf('?');
    if (lidx > -1)
        back_url = back_url.substring(0, lidx);

    models.Record
        .findOne({"_id": id})
        .exec(function(err, record) {
            var from, to;

            if (is_mobile) {
                from = record.from.toISOString();
                to = record.to.toISOString();
            } else {
                from = datetimePickerFormat(record.from);
                to = datetimePickerFormat(record.to);
            }

            res.render('edit', {
                is_mobile: is_mobile,
                id: record._id,
                task: record.task,
                from: from,
                to: to,
                back_url: back_url
            });
        });
};

exports.add_record = function(req, res) {
    var form_data = req.body;
    console.log("form data");
    console.log(form_data);
    var record = new models.Record({
        'task': form_data.task,
        'from': form_data.from,
        'to': form_data.to,
        'user': req.session.username
    });
    record.save(afterSaving);

    function afterSaving(err) {
        if (err) {
            console.log(err);
            res.send(500);
        }
        res.redirect('/');
    }
};

exports.update_record = function(req, res) {
    var form_data = req.body;
    if (!form_data.id) {
        res.send(404);
        return;
    }

    models.Record.findOne({
        "_id": form_data.id
    }).exec(function(err, record) {
        if (err) {
            console.log(err);
            res.send(404);
        }

        record.task = form_data.task;
        record.from = form_data.from;
        record.to = form_data.to;

        record.save(function(err) {
            if (err) {
                console.log(error);
                res.send(500);
            }
            res.send(200);
        });
    });
};

exports.usage = function(req, res) {
    res.render('usage');
};

exports.trend = function(req, res) {
    res.render('trend');
};

exports.history_prev = function(req, res) {
    var last_date = req.query.date;
    console.log(last_date);
    var high = new Date(last_date);
    var low = new Date();
    low.setDate(high.getDate() - 5);
    low.setHours(0);
    low.setMinutes(0);
    low.setSeconds(0);
    models.Record
        .find({
            'user': req.session.username,
            'from': {$lt: high, $gte: low}
        })
        .exec(function(err, records) {
            var lists = populateRecords(records, low, high);
            lists.sort(function(a, b) {
                return new Date(a.date) < new Date(b.date);
            });
            res.render('includes/history-items', {
                items: lists
            });
        });
};

exports.history_day = function(req, res) {
    var parts = [req.params.year, req.params.month, req.params.day];
    var last_date = parts.join('-');
    var high = new Date(last_date + ' 23:59:59');
    var low = new Date(last_date + ' 00:00:00');

    models.Record
    .find({
        'user': req.session.username,
        'from': {$lt: high, $gte: low}
    })
    .exec(function(err, records) {
        var lists = populateRecords(records, low, high);
        res.render('history-day', {
            date: last_date,
            back_url: req.get('Referer'),
            items: lists
        });
    });
};
