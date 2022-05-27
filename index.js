const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./databases/database.db');

const token = '5173499293:AAEjTu3z7N-6rhpJxHhhDPV_gR85hlTc-LA';

const bot = new TelegramBot(token, {polling: true});

db.run("CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, designer BOOL, task_id INTEGER NOT NULL, stage TEXT, banned BOOL, admin BOOL, usr_name TEXT, type TEXT)");
db.run("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL, type TEXT, about TEXT, done BOOL, working BOOL, designer INTEGER, des_usr TEXT)");

function get_user(usr_id) {
    return new Promise(
        (resolve, reject) => {
            db.serialize(() => {
                db.get('SELECT * FROM users WHERE user_id = ?', usr_id, (err, rows) => {
                    if (err) {reject(err);}
                    resolve(rows);
                });
            });
        }
    );
}


function get_task_info(usr_id) {
    return new Promise(
        (resolve, reject) => {
            db.serialize(() => {
                db.get('SELECT * FROM tasks WHERE customer_id = ? AND id = (SELECT max(id) FROM tasks WHERE customer_id = ?)', usr_id, usr_id, (err, rows) => {
                    if (err) {reject(err);}
                    resolve(rows);
                });
            });
        }
    );
}


function get_task_query(type) {
    return new Promise(
        (resolve, reject) => {
            db.serialize(() => {
                db.all('SELECT * FROM tasks WHERE working = ? AND type = ?', false, type, (err, rows) => {
                    if (err) {reject(err);}
                    resolve(rows);
                });
            });
        }
    );
}


function get_task_info_by_id(task_id) {
    return new Promise(
        (resolve, reject) => {
            db.serialize(() => {
                db.get('SELECT * FROM tasks WHERE id = ?', task_id, (err, rows) => {
                    if (err) {reject(err);}
                    resolve(rows);
                });
            });
        }
    );
}


function set_stage(stage, usr_id) {
    const pr = db.prepare("UPDATE users SET stage = ? WHERE user_id = ?");
    pr.run(stage, usr_id);
    pr.finalize();
}


bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    var stage;
    
    var stage_temp = get_user(chatId).then(results => {
        if (results) {
            if (results.banned) {
                bot.sendMessage(chatId, "Просим прощения, но вы были забанены");
                return;
            } else if (text == '/start') {
                set_stage('role_choose', chatId);
                bot.sendMessage(chatId, "Привет, сначала выбери свою роль", {
                    reply_markup: {
                        resize_keyboard: true,
                        one_time_keyboard: true,
                        keyboard: [
                            ["Я заказчик"],
                            ["Я дизайнер"]
                        ]
                    }
                });
                return;
            }
        } else if (text == '/start') {
            const pr = db.prepare("INSERT OR REPLACE INTO users (user_id, designer, task_id, stage, banned, admin, usr_name, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            pr.run(chatId, false, -1, "role_choose", false, false, '@' + msg.chat.username, '');
            pr.finalize();
            bot.sendMessage(chatId, "Привет, сначала выбери свою роль", {
                reply_markup: {
                    resize_keyboard: true,
                    one_time_keyboard: true,
                    keyboard: [
                        ["Я заказчик"],
                        ["Я дизайнер"]
                    ]
                }
            });
            return;
        }
        if (text) {
            if (text.includes('/ban') && results.admin) {
                let us_id = parseInt(text.slice(5));
                const pr = db.prepare("UPDATE users SET banned = ? WHERE user_id = ?");
                pr.run(true, us_id);
                pr.finalize();
                bot.sendMessage(chatId, `Пользователь ${us_id} забанен`);
            }
    
            if (text.includes('/unban') && results.admin) {
                let us_id = parseInt(text.slice(7));
                const pr = db.prepare("UPDATE users SET banned = ? WHERE user_id = ?");
                pr.run(false, us_id);
                pr.finalize();
                bot.sendMessage(chatId, `Пользователь ${us_id} разбанен`);
            }
    
            if (text.includes('/info') && results.admin) {
                let us_id = text.slice(6);
                if (us_id == 'all') {
                    db.serialize(() => {
                        db.all('SELECT * FROM tasks', (err, rows) => {
                            let mess = 'Количество выполненных заданий:\n';
                            let nms = {};
                            rows.forEach(el => {
                                let _ = el.des_usr;
                                nms[_] = 0;
                            });
                            rows.forEach(el => {
                                let _ = el.des_usr;
                                nms[_] = nms[_] + 1;
                            });
                            for (var prop in nms) {
                                console.log(prop);
                                mess += `${prop} : ${nms[prop]}\n`;
                            }
                            console.log(nms);
                            console.log(msg);
                            bot.sendMessage(chatId, mess);
                        });
                    });
                } else {
                    us_id = parseInt(us_id);
                    db.serialize(() => {
                        db.all('SELECT * FROM tasks WHERE designer = ?', us_id, (err, rows) => {
                            bot.sendMessage(chatId, `Пользователь ${us_id} выполнил ${rows.length} заданий`);
                        });
                    });
                }
            }
    
    
            if (text.includes('/new_admin') && results.admin) {
                let us_id = parseInt(text.slice(11));
                const pr = db.prepare("UPDATE users SET admin = ? WHERE user_id = ?");
                pr.run(true, us_id);
                pr.finalize();
                bot.sendMessage(chatId, `Пользователю ${us_id} выдана админка`);
            }
    
            if (text.includes('/del_admin') && results.admin) {
                let us_id = parseInt(text.slice(11));
                const pr = db.prepare("UPDATE users SET admin = ? WHERE user_id = ?");
                pr.run(false, us_id);
                pr.finalize();
                bot.sendMessage(chatId, `У пользователя ${us_id} забрана админка`);
            }
        }

        stage = results.stage;
        console.log(stage);
    
        if (stage == 'role_choose') {
            if (text == 'Я заказчик') {
                const pr = db.prepare("UPDATE users SET designer = ? WHERE user_id = ?");
                pr.run(false, chatId);
                pr.finalize();
                bot.sendMessage(chatId, "Что ты хочешь заказать?", {
                    reply_markup: {
                        resize_keyboard: true,
                        one_time_keyboard: true,
                        keyboard: [
                            ["Картинка"],
                            ["Видео"]
                        ]
                    }
                });
                set_stage('choose_photo_video', chatId);
            } else if (text == 'Я дизайнер') {
                // const pr = db.prepare("UPDATE users SET designer = ?, stage = ? WHERE user_id = ?");
                // pr.run(true, 'waiting_task', chatId);
                // pr.finalize();
                // bot.sendMessage(chatId, "Нажми на кнопку чтобы взять следующий заказ", {
                //     reply_markup: {
                //         resize_keyboard: true,
                //         one_time_keyboard: true,
                //         keyboard: [
                //             ["Следующий заказ"]
                //         ]
                //     }
                // })

                const pr = db.prepare("UPDATE users SET designer = ?, stage = ? WHERE user_id = ?");
                pr.run(true, 'des_choose_type', chatId);
                pr.finalize();
                bot.sendMessage(chatId, "Что ты будешь делать?", {
                    reply_markup: {
                        resize_keyboard: true,
                        one_time_keyboard: true,
                        keyboard: [
                            [
                                "Картинки",
                                "Видео"
                            ]
                        ]
                    }
                })
            }
        } else if (stage == 'des_choose_type') {
            let _t = 'video';
            if (text == 'Картинки') {
                _t = 'photo';
            }
            const pr = db.prepare("UPDATE users SET type = ?, stage = ? WHERE user_id = ?");
            pr.run(_t, 'waiting_task', chatId);
            pr.finalize();
            bot.sendMessage(chatId, "Готово!\nНажми на кнопку чтобы взять следующий заказ", {
                reply_markup: {
                    resize_keyboard: true,
                    one_time_keyboard: true,
                    keyboard: [
                        ["Следующий заказ"]
                    ]
                }
            })
        } else if (stage == 'choose_photo_video') {
            if (text == 'Картинка') {
                const pr = db.prepare("INSERT INTO tasks (customer_id, type, about, done, working) VALUES (?, ?, ?, ?, ?)");
                pr.run(chatId, 'photo', 'none', false, false);
                pr.finalize();
                bot.sendMessage(chatId, "Теперь отправь ТЗ к заданию")
                set_stage('set_about', chatId);
            } else if (text == 'Видео') {
                const pr = db.prepare("INSERT INTO tasks (customer_id, type, about, done, working) VALUES (?, ?, ?, ?, ?)");
                pr.run(chatId, 'video', 'none', false, false);
                pr.finalize();
                bot.sendMessage(chatId, "Теперь отправь ТЗ к заданию")
                set_stage('set_about', chatId);
            }
        } else if (stage == 'set_about') {
            const pr = db.prepare("UPDATE tasks SET about = ? WHERE customer_id = ? AND id = (SELECT max(id) FROM tasks WHERE customer_id = ?)");
            pr.run(text, chatId, chatId);
            pr.finalize();

            // db.serialize(() => {
            //     db.all('SELECT user_id FROM users WHERE task_id = ? AND designer = ?', -1, true, (err, rows) => {
            //         var about_temp = get_task_info(chatId).then(results => {
            //             //console.log(results);
            //             var about = results.about;
            //             var type = results.type;
            //             var _task_id = results.id;
                        
            //             if (type == 'photo') {type = 'Картинка'}
            //             else {type = 'Видео'}
            //             rows.forEach(el => {
            //                 try {
            //                     bot.sendMessage(el.user_id, `Новое задание (${type}):${about}`, {
            //                         reply_markup: {
            //                             inline_keyboard: [[
            //                                 {
            //                                     text: 'Принять задание',
            //                                     callback_data: `task_${_task_id}`
            //                                 }
            //                             ]]
            //                         }
            //                     });
            //                 } catch {
            //                     console.log(el.user_id + ' SEND ERROR');
            //                 }
            //             });
            //         });
            //     });
            // });

            bot.sendMessage(chatId, "Задание отправлено исполнителям");
            set_stage('waiting_ready', chatId);
        } else if (stage == 'waiting_task') {
            if (text == 'Следующий заказ') {
                var about_temp = get_task_query(results.type).then(results => {
                    
                    console.log(results.length);
                    if (results.length != 0) {
                        results = results[0];
                        var about = results.about;
                        var type = results.type;
                        var _task_id = results.id;
                        
                        if (type == 'photo') {type = 'Картинка'}
                        else {type = 'Видео'}
                        bot.sendMessage(chatId, `Новое задание (${type}):${about}`, {
                            reply_markup: {
                                inline_keyboard: [[
                                    {
                                        text: 'Принять задание',
                                        callback_data: `task_${_task_id}`
                                    }
                                ]]
                            }
                        });
                    } else {
                        bot.sendMessage(chatId, "Пока что нет новых заданий, попробуй позже", {
                            reply_markup: {
                                resize_keyboard: true,
                                one_time_keyboard: true,
                                keyboard: [
                                    ["Следующий заказ"]
                                ]
                            }
                        });
                    }
                });
            }
        } else if (stage == 'task_working') {
            const usr_id = results.user_id;
            const task_id = results.task_id;
            
            var task_temp = get_task_info_by_id(task_id).then(result => {
                const customer = result.customer_id;
                bot.copyMessage(customer, usr_id, msg.message_id);
                const pr = db.prepare("UPDATE tasks SET done = ? WHERE id = ?");
                pr.run(true, task_id);
                pr.finalize();
                const pr2 = db.prepare("UPDATE users SET task_id = ?, stage = ? WHERE user_id = ?");
                pr2.run(-1, 'waiting_task', chatId);
                pr2.finalize();
                bot.sendMessage(chatId, 'Задание выполнено и отправленно!', {
                    reply_markup: {
                        resize_keyboard: true,
                        one_time_keyboard: true,
                        keyboard: [
                            ["Следующий заказ"]
                        ]
                    }
                });

                bot.sendMessage(customer, "Хочешь ещё что-то заказать?", {
                    reply_markup: {
                        resize_keyboard: true,
                        one_time_keyboard: true,
                        keyboard: [
                            ["Картинка"],
                            ["Видео"]
                        ]
                    }
                });
                set_stage('choose_photo_video', customer);
            });
        }
    });
});

// bot.on('photo', (msg) => {
//     console.log(msg);
//     const chatId = msg.chat.id;

//     var stage_temp = get_user(chatId).then(results => {
//         const stage = results.stage;
//         const usr_id = results.user_id;
//         const task_id = results.task_id;
//         if (stage == 'task_working') {
//             var task_temp = get_task_info_by_id(task_id).then(result => {
//                 const customer = result.customer_id;
//                 bot.copyMessage(customer, usr_id, msg.message_id);
//                 const pr = db.prepare("UPDATE tasks SET done = ? WHERE id = ?");
//                 pr.run(true, task_id);
//                 pr.finalize();
//                 const pr2 = db.prepare("UPDATE users SET task_id = ?, stage = ? WHERE user_id = ?");
//                 pr2.run(-1, 'waiting_task', chatId);
//                 pr2.finalize();
//                 bot.sendMessage(chatId, 'Задание выполнено и отправленно!', {
//                     reply_markup: {
//                         resize_keyboard: true,
//                         one_time_keyboard: true,
//                         keyboard: [
//                             ["Следующий заказ"]
//                         ]
//                     }
//                 });

//                 bot.sendMessage(customer, "Хочешь ещё что-то заказать?", {
//                     reply_markup: {
//                         resize_keyboard: true,
//                         one_time_keyboard: true,
//                         keyboard: [
//                             ["Картинка"],
//                             ["Видео"]
//                         ]
//                     }
//                 });
//                 set_stage('choose_photo_video', customer);
//             });
//         }
//     });
// });

// bot.on('video', (msg) => {
//     console.log(msg);
//     const chatId = msg.chat.id;

//     var stage_temp = get_user(chatId).then(results => {
//         const stage = results.stage;
//         const usr_id = results.user_id;
//         const task_id = results.task_id;
//         if (stage == 'task_working') {
//             var task_temp = get_task_info_by_id(task_id).then(result => {
//                 const customer = result.customer_id;
//                 bot.copyMessage(customer, usr_id, msg.message_id);
//                 const pr = db.prepare("UPDATE tasks SET done = ? WHERE id = ?");
//                 pr.run(true, task_id);
//                 pr.finalize();
//                 const pr2 = db.prepare("UPDATE users SET task_id = ?, stage = ? WHERE user_id = ?");
//                 pr2.run(-1, 'waiting_task', chatId);
//                 pr2.finalize();
//                 bot.sendMessage(chatId, 'Задание выполнено и отправленно!', {
//                     reply_markup: {
//                         resize_keyboard: true,
//                         one_time_keyboard: true,
//                         keyboard: [
//                             ["Следующий заказ"]
//                         ]
//                     }
//                 });

//                 bot.sendMessage(customer, "Хочешь ещё что-то заказать?", {
//                     reply_markup: {
//                         resize_keyboard: true,
//                         one_time_keyboard: true,
//                         keyboard: [
//                             ["Картинка"],
//                             ["Видео"]
//                         ]
//                     }
//                 });
//                 set_stage('choose_photo_video', customer);
//             });
//         }
//     });
// });

// bot.on('document', (msg) => {
//     console.log(msg);
//     const chatId = msg.chat.id;

//     var stage_temp = get_user(chatId).then(results => {
//         const stage = results.stage;
//         const usr_id = results.user_id;
//         const task_id = results.task_id;
//         if (stage == 'task_working') {
//             var task_temp = get_task_info_by_id(task_id).then(result => {
//                 const customer = result.customer_id;
//                 bot.copyMessage(customer, usr_id, msg.message_id);
//                 const pr = db.prepare("UPDATE tasks SET done = ? WHERE id = ?");
//                 pr.run(true, task_id);
//                 pr.finalize();
//                 const pr2 = db.prepare("UPDATE users SET task_id = ?, stage = ? WHERE user_id = ?");
//                 pr2.run(-1, 'waiting_task', chatId);
//                 pr2.finalize();
//                 bot.sendMessage(chatId, 'Задание выполнено и отправленно!', {
//                     reply_markup: {
//                         resize_keyboard: true,
//                         one_time_keyboard: true,
//                         keyboard: [
//                             ["Следующий заказ"]
//                         ]
//                     }
//                 });

//                 bot.sendMessage(customer, "Хочешь ещё что-то заказать?", {
//                     reply_markup: {
//                         resize_keyboard: true,
//                         one_time_keyboard: true,
//                         keyboard: [
//                             ["Картинка"],
//                             ["Видео"]
//                         ]
//                     }
//                 });
//                 set_stage('choose_photo_video', customer);
//             });
//         }
//     });
// });

bot.on("callback_query", (callbackQuery) => {
    console.log(callbackQuery);
    const data = callbackQuery.data;
    const task_id = parseInt(data.slice(5));
    console.log(task_id);

    var _ = get_task_info_by_id(task_id).then(results => {
        const working = results.working;
        const customer = results.customer_id;
        console.log(working);
        if (working) {
            bot.answerCallbackQuery(callbackQuery.id).then(() => {
                bot.sendMessage(callbackQuery.from.id, 'Кто-то уже принял заказ', {
                    reply_markup: {
                        resize_keyboard: true,
                        one_time_keyboard: true,
                        keyboard: [
                            ["Следующий заказ"]
                        ]
                    }
                });
            });
        } else {
            bot.answerCallbackQuery(callbackQuery.id).then(() => {
                const pr = db.prepare("UPDATE tasks SET working = ?, designer = ?, des_usr = ? WHERE id = ?");
                pr.run(true, callbackQuery.from.id, '@' + callbackQuery.from.username, task_id);
                pr.finalize();
                const pr2 = db.prepare("UPDATE users SET task_id = ?, stage = ? WHERE user_id = ?");
                pr2.run(task_id, 'task_working', callbackQuery.from.id);
                pr2.finalize();
                var _temp = get_user(customer).then(results => {
                    bot.sendMessage(callbackQuery.from.id, 'Вы приняли заказ от ' + results.usr_name);
                });
                bot.sendMessage(customer, `Пользователь @${callbackQuery.from.username} принял твой заказ`);
            });
        }
    });
});
