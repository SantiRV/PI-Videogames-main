const { Router } = require('express');
// Importar todos los routers;
// Ejemplo: const authRouter = require('./auth.js');
//const { API_KEY } = process.env;
const axios = require('axios');
const API_KEY = '6bfb9c55de844894b9cf9b509ebdf535';
const { Videogame, Genre, Platform } = require('../db.js');

const router = Router();

// Configurar los routers
// Ejemplo: router.use('/auth', authRouter);
//Utlizo el async await porque uno nunca sabe cuanto va a tardar en dar la respuesta 
//Tengo que avisarle que tiene que esperar a la respuesta para cargarle la info a la variable aUrl
const getApiInfo = async ()=> {
    var juegos = [];

    const aUrl1 = axios.get(`https://api.rawg.io/api/games?key=${API_KEY}`);
    const aUrl2 = axios.get(`https://api.rawg.io/api/games?key=${API_KEY}&page=2`);
    const aUrl3 = axios.get(`https://api.rawg.io/api/games?key=${API_KEY}&page=3`);
    const aUrl4 = axios.get(`https://api.rawg.io/api/games?key=${API_KEY}&page=4`);
    const aUrl5 = axios.get(`https://api.rawg.io/api/games?key=${API_KEY}&page=5`);
//Mapeo y traigo solo la info que me piden o necesito con una promise ya que es la forma mas rapida de traerme tanta info 
//y no quiero que mi pagina se cuelgue mucho tiempo para traerme la info
//Hago destructuring de todo lo que necesito y lo mapeo
    return Promise.all([aUrl1,aUrl2,aUrl3,aUrl4,aUrl5]).then((resolve) => {
        let [aUrl1,aUrl2,aUrl3,aUrl4,aUrl5] = resolve;
        
        juegos = [
            ...aUrl1.data.results,
            ...aUrl2.data.results,
            ...aUrl3.data.results,
            ...aUrl4.data.results,
            ...aUrl5.data.results,
        ].map((el) => {
            const plataformas = el.platforms.map((g) => g.platform);
            return {
                id: el.id,
                name: el.name,
                img: el.background_image,
                description: el.description,
                released: el.released,
                rating: el.rating,
                platform: plataformas,
                genres: el.genres,
            };
        });
        return juegos;
    })
    .catch((err) => console.log(err));
};
//Traigo la info de mi base de datos
//Aca le pido que me traiga videogame pero que ademas me incluya los modelos de Genre y Patform  
const getBdInfo = async () => {
    return await Videogame.findAll({
        include: [Genre, Platform],
    });
};
//concateno la info de la api con mi base de datos, retorna un arreglo con toda la info
const getAllVideogames = async () => {
    const apiInfo = await getApiInfo();
    const bdInfo = await getBdInfo();
    const allInfo = apiInfo.concat(bdInfo);
    return allInfo;
};

//con respecto a lo que escriba en la url-->query
router.get('/videogames', async (req,res) => {
    const name = req.query.name; //busca si hay un name por query
    let allVideogames = await getAllVideogames();

    if(name) {
        let videgameNames = await allVideogames.filter((el) => el.name.toLowerCase().includes(name.toLowerCase())); //paso el nombre que me llega a minuscula y el que llega por query tambien 
                                                                                                                   //lo pasa a minuscula para que coincidan si es que existe
       videgameNames.length ? 
       res.status(200).send(videgameNames) : 
       res.status(404).send('Game Not Found');
    } else {
        res.status(200).send(allVideogames);
    };
});

router.get('/platforms', async (req,res) => {
    try {
        const platformsApi = await axios.get(`https://api.rawg.io/api/platforms?key=${API_KEY}`);
        const plataformas = platformsApi.data.results;
        res.json(plataformas);
    } catch(err) {
        res.send(err);
    };
});

//Filtro de plataforma

router.get('/platform/:id', async (req,res) => {
    const { id } = req.params;
    const gamesPlatform = await axios.get(`https://api.rawg.io/api/games?platforms=${id}&key=${API_KEY}`);
    const infoPlatform = gamesPlatform.data.results;
    const mapear = infoPlatform?.map((el) => {
        const plataformas = el.platforms.map((g) => g.platform);
        return {
            id: el.id,
            name: el.name,
            img: el.background_image,
            description: el.description,
            released: el.released,
            raiting: el.raiting,
            platforms: plataformas,
            genres: el.genres,
        };
    });
    return res.json(mapear);
});

//Genres

router.get('/genres', async (req,res) => {
    const genresApi = await axios.get(`https://api.rawg.io/api/genres?key=${API_KEY}`);
    const genres = genresApi.data.results;
    genres.forEach(async (el) => {
        await Genre.findOrCreate({
            where: {
                name: el.name, //aqui ponemos lo que queremos que se guarde en nuestra base de datos
            }
        });
    });
    const allGenres = await Genre.findAll();
    res.status(200).send(allGenres);
});

//Filter by Generes

router.get('/genres/:name', async (req,res) => {
    const { name } = req.params;
    const gamesGenre = await axios.get(`https://api.rawg.io/api/games?genre=${name}&key=${API_KEY}`);
    const infoGenre = gamesGenre.data.results;
    const mapear = infoGenre?.map((el) => {
        const plataformas = el.platforms.map((g) => g.platform);
        return {
            id: el.id,
            name: el.name,
            img: el.background_image,
            description: el.description,
            released: el.released,
            raiting: el.raiting,
            platforms: plataformas,
            genres: el.genres,
        };
    });
    return res.json(mapear);
});

router.post('/videogame', async (req,res) => {
    const { name, description, released, rating, platforms, genres } = req.body;
    let createVidogame = await Videogame.create({
        name,
        description,
        released,
        rating,
    });
    let BdGenre = await Genre.findAll({
        where: {name: genres},
    });
    let bdPlatform = await Platform.findAll({
        where: {name: platforms},
    });

    createVidogame.addGenres(BdGenre);
    createVidogame.addPlatforms(bdPlatform);
    res.status(200).send(createVidogame);
});

router.get('/videogame/:id', async (req,res) => {
    const { id } = req.params.id;
    const allVideogames = await getAllVideogames();
    
    if(id) {
        let videogameId = await allVideogames.filter((el) => el.id === id);
        videogameId.length?
        res.status(200).json(videogameId) :
        res.status(404).send('Videogame not found');
    };
});


module.exports = router;
