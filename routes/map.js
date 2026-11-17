const express = require('express')
const router = express.Router()

const { User, MatchRequest, sequelize} = require('../models')

const {Op} = require('sequelize')

router.get('/nearby', async(req, res) => {
    
    try {
        const {lat, lng, radius, userId} = req.query
        const latitude = Number(lat), longitude = Number(lng), km = Number(radius)
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
            !Number.isFinite(km) || km <= 0 || !/^\d+$/.test(String(userId))) {
            return res.status(400).json({success: false, message: '좌표, 반경, 사용자 ID를 확인해주세요.'})
        }
        const radiusInMeters = km * 1000
        const distanceQuery = sequelize.literal(
            `ST_Distance_Sphere(point(longitude, latitude), point(${longitude}, ${latitude}))`
        )
        const nearbyUsers = await User.findAll({
            where: {
                id: {[Op.ne]: userId},
                [Op.and]: sequelize.where(distanceQuery, '<=', radiusInMeters)
            },
            attributes: [
                'id', 'nickname', 'gender', 'bio',
                [distanceQuery, 'distanceValue']
            ]
        })
        res.json({success: true, users: nearbyUsers})

    } catch (error) {
        console.error(error)
        res.status(500).json({success: false, message: '서버 오류'})
    }
})

module.exports = router
