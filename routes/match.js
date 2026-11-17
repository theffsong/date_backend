const express = require('express')
const router = express.Router()

const { User, MatchRequest, PointHistory, sequelize} = require('../models')

router.post('/request', async (req, res) => {
    try {
        const {senderId, receiverId} = req.body
        const existing = await MatchRequest.findOne({
            where: {sender_id: senderId, receiver_id: receiverId}
        })

        if (existing) {
            return res.status(400).json({success: false, message: '이미 요청을 보냈습니다'})
        }

        await MatchRequest.create({
            sender_id: senderId,
            receiver_id: receiverId,
            status: 'PENDING'
        })
        res.json({success: true, message: '요청 완료'})

    } catch (error) {
        res.status(500).json({success: false, message: '요청 실패'})
    }
})

router.post('/respond', async(req, res) => {
    try {
        const {requestId, responderId, action} = req.body
        const request = await MatchRequest.findByPk(requestId)
        
        if (!request || String(request.receiver_id) !== String(responderId) || request.status !== 'PENDING') {
            return res.status(400).json({success: false, message: '유효하지 않은 요청입니다'})
        }
        if (!['ACCEPT', 'REJECT'].includes(action)) {
            return res.status(400).json({success: false, message: '수락 또는 거절을 선택해주세요.'})
        }
        if (action === 'REJECT') {
            await request.update({status: 'REJECTED'})
            return res.json({success: true, message: '거절 처리 되었습니다'})
        }
        if (action === 'ACCEPT') {
            await request.update({status:'ACCEPTED'})
            await MatchRequest.update(
                {status: 'REJECTED'},
                {where: {receiver_id: responderId, status: 'PENDING'}}
            )
            return res.json({success: true, message: '매칭이 수락되었습니다. 약속을 잡아보세요'})
        }
    } catch (error) {
        res.status(500).json({success: false, message: '서버 오류'})
    }
})

router.post('/complete', async(req, res) => {
    const MATCH_COST = 10000
    const t = await sequelize.transaction()
    try {
        const {requestId} = req.body
        const request = await MatchRequest.findByPk(requestId, {transaction: t, lock: t.LOCK.UPDATE}) 
        
        if (!request || request.status !== 'ACCEPTED') {
            throw new Error('정상적인 만남 완료 대상이 아닙니다')
        }

        const sender = await User.findByPk(request.sender_id, {transaction: t, lock: t.LOCK.UPDATE})
        const receiver = await User.findByPk(request.receiver_id, {transaction: t, lock: t.LOCK.UPDATE})

        if (!sender || !receiver || String(sender.id) === String(receiver.id)) {
            throw new Error('매칭 참여자 정보를 확인해주세요.')
        }

        if (sender.points < MATCH_COST || receiver.points < MATCH_COST) {
            throw new Error ('포인트가 부족하여 만남을 완료할 수 없습니다. 충전이 필요합니다')
        }

        await sender.decrement('points', {by: MATCH_COST, transaction: t})
        await receiver.decrement('points', {by: MATCH_COST, transaction: t})
        await request.update({status: 'COMPLETED'}, {transaction: t})
        await PointHistory.bulkCreate([
            {user_id: sender.id, amount: -MATCH_COST, reason: '만남 완료(발신)'},
            {user_id: receiver.id, amount: -MATCH_COST, reason: '만남 완료(수신)'}
        ], {transaction: t})

        await t.commit()
        res.json({success: true, message: '만남 완료! 포인트가 차감되었습니다'})

    } catch (error) {
        await t.rollback()
        res.status(400).json({success: false, message: error.message})
    }
})

module.exports = router
