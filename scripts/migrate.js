'use strict';
require('../backend/config');const {db}=require('../backend/database');
(async()=>{await db.ready;await require("../backend/site-content").migrateContent(db);console.log(`Database schema initialized (${db.driver}).`);})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.close());
