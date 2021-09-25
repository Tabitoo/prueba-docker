const Redis = require("ioredis");
const { Socket } = require("socket.io");
const redis = new Redis(6379, "172.17.0.1");
const jwt = require("jsonwebtoken");
const {getSocket,getIo, getRoom} = require('../sockets');

module.exports = {
    issueJoin : (req,res) => {

        let issue = req.params.issue;
        
        let coso = async (id,body) => {
            try {

              
                //let sets = await redis.sadd("issueID", id);

                let issueObject = await redis.get("issue:" + id);
                

                if(issueObject == null){

                    issueObject = {
                        id: id,
                        status : "joining",
                        members : [
                            {name : body.name, rol : body.rol, status : "joining", id: 1, vote: false}
                        ]
                    }

                    await redis.set("issue:" + id, JSON.stringify(issueObject));

                    return await res.status(200).json({data : issueObject});
                    
                }else {

                    issueObject = JSON.parse(issueObject);
                    
                    if(body.rol == "scrumMaster"){
                        
                        if(issueObject.members.find(member => member.rol == "scrumMaster")){
                            return res.json({
                                status : "error",
                                data : "ya se encuentra un scrum master"
                            })
                        }
                        
                    }

                    if(issueObject.status != "joining") {
                        return res.json({
                            status : "error",
                            data : "error al unirse a la sala, la votacion ya inicio"
                        })
                    }

                    issueObject.members.push({name : body.name, rol : body.rol, status : "joining", id: issueObject.members.length + 1, vote: false});

                    await redis.set("issue:" + id, JSON.stringify(issueObject));

                    return res.json({data : issueObject});

                }
            } catch (error) {
                console.log(error)
            }

        }

        coso(issue,req.body);
        
    },
    getIssue: (req,res) => {
        //let issue = req.params.id;

        let getId = async (id) => {

            try {

                

                let issueObject = await redis.get("issue:" + id);
                
                issueObject = JSON.parse(issueObject);

                if(getSocket()){
                    
                    console.log("evento desde client:issue")
                    getIo().emit("server:msg","esto es un mensaje, que ande porfavor!!");
                    getSocket().on("client:mensaje", (data) => console.log(data))
                    getIo().to(Number(id)).emit("server:issue", issueObject);
                    
                }

                return res.status(200).json({
                    data : issueObject
                })
            } catch (error) {
                console.log(error)
            }
            
        }

        getId(req.params.id);
    },
    issuePrueba: (req,res) => {
        return res.json({
            data : "hola buenas esto es una prueba"
        })
    },
    issueVote : (req,res) => {

        let id = req.params.issue;
        let body = req.body;

        console.log(id)

        let issueStatus = async (id,body) => {

            try {

                let issueObject = await redis.get(`issue:${id}`);
                issueObject = JSON.parse(issueObject);

                if(body.rol === "scrumMaster") {
                        
                    issueObject.status = body.status;

                    await redis.set(`issue:${id}`, JSON.stringify(issueObject));

                    if(getSocket()) {

                        getIo().to(Number(id)).emit("server:issueStatus", issueObject.status);

                    }

                } else {
                    let user = body.user;

                    let index = issueObject.members.findIndex(usuario => usuario.id == user.id);

                    issueObject.members[index] = user;

                    await redis.set(`issue:${id}`, JSON.stringify(issueObject));

                    if(getSocket()) {

                        getIo().to(Number(id)).emit("server:issueVote", issueObject.members);

                    }


                }
                    

                return res.status(200).json({
                    status : 200,
                    data : issueObject
                })
                
            } catch (error) {
                console.log(error);
            }

        }

        issueStatus(id,body);

    },
    restarIssue : (req, res) => {

        let issue = req.params.issue;
        let body = req.body;

        let restarVote = async (id, body) => {

            console.log(body);

            let issueObject = await redis.get(`issue:${id}`);
            issueObject = JSON.parse(issueObject);

            issueObject.members.forEach(member => {

                member.vote = false;
                
            });

            let response = await redis.set(`issue:${id}`, JSON.stringify(issueObject));

            if(response == "OK") {
                getIo().to(Number(id)).emit("server:restarIssue", issueObject.members);

                return res.json({
                    status : 200,
                    data : "ok"
                })
            } 

        }

        restarVote(issue,body);

    },

    deleteIssue: (req,res) => {
        let issue = req.params.issue;
        let body = req.body;

        let roomDelete = async (body,issue) => {
            try {
                    
                let issueObject = await redis.get(`issue:${issue}`);

                issueObject = JSON.parse(issueObject);

                let user = issueObject.members.find(user => user.id == body.id);

                if(user.rol == "scrumMaster"){

                    let remove = await redis.del(`issue:${issue}`);

                    if(remove != 0){

                        getIo().to(Number(issue)).emit("client:disconnect");

                        return res.status(200).json({
                            data : "ok"
                        })

                    }

                } else {
                    return res.json({
                        data : "error",
                        msg : "Es necesario ser scrumMaster para eliminar la sala"
                    })
                }

                
            } catch (error) {

                console.log(error)

                
            }




        }

        roomDelete(body,issue);
    }
} 
