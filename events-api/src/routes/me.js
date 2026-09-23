'use strict';

const express = require('express');
const { asyncHandler } = require('../errors');
const { DEFAULT_ACCESS, ROLE_LABELS, SCREEN_GROUPS } = require('../access');
const { listStaff, listBranches, loadSettings } = require('../company');

// Кто я и что мне доступно — первое, что запрашивает интерфейс мероприятий,
// чтобы построить меню. Плюс справочники, общие для нескольких экранов.
function meRouter({ db, identity }) {
  const r = express.Router();

  r.get('/me', asyncHandler(async (req, res) => {
    const u = req.user;
    res.json({
      user: {
        id: u.id,
        username: u.username,
        role: u.role,
        role_label: ROLE_LABELS[u.role],
        first_name: u.first_name,
        last_name: u.last_name,
        company_id: u.company_id,
        company_name: u.company_name,
        company_logo_url: u.company_logo_url,
        branch_id: u.branch_id,
        act_as: u.act_as,
        impersonator_name: u.impersonator_name || null,
      },
      screens: SCREEN_GROUPS.filter((g) => (DEFAULT_ACCESS[u.role] || []).includes(g)),
    });
  }));

  r.get('/staff', asyncHandler(async (req, res) => {
    res.json({ items: (await listStaff(identity, req.user.company_id)).filter((s) => !s.is_blocked) });
  }));

  r.get('/branches', asyncHandler(async (req, res) => {
    res.json({ items: await listBranches(identity, req.user.company_id) });
  }));

  r.get('/settings', asyncHandler(async (req, res) => {
    res.json(await loadSettings(db, req.user.company_id));
  }));

  return r;
}

module.exports = { meRouter };
