#!/usr/bin/env node
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const remote = '/etc/nginx/sites-available/almutamayiziq.com';
const local = path.join(__dirname, '..', 'deploy', 'nginx-almutamayiziq-live.conf');

const conn = new Client();
conn
  .on('ready', () => {
    conn.sftp((err, sftp) => {
      if (err) throw err;
      sftp.fastGet(remote, local, (e) => {
        conn.end();
        if (e) {
          console.error(e);
          process.exit(1);
        }
        console.log('Saved', local);
      });
    });
  })
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({
    host: '161.97.140.171',
    username: 'root',
    password: process.env.VPS_PASSWORD || '',
    readyTimeout: 120000,
  });
