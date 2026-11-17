const path = require('path');
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  // 실행 위치와 상관없이 프로젝트 루트의 dating_db.sqlite 사용
  storage: path.join(__dirname, '..', 'dating_db.sqlite'),
  logging: false,
});

module.exports = sequelize;