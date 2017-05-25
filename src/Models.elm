module Models exposing (..)

--import Json.Encode exposing (Value)

type alias Context =
    { id : String
    , name : String
    , selectors : List Selector
    }

type alias Entity =
    { primaryPick : Int
    , pickedElements : List Element
    , selector : String
    , dataExtractor : Maybe DataExtractor
    }

type alias DataExtractor =
    { source : String
    }

type alias Selector =
    { name : String
    , entity : Entity
    , isCollection : Bool
    , filter : SelectionFilter
    }

type alias Element =
    { x : Int
    , y : Int
    , distanceToTop : Int
    , width : Int
    , height : Int
    , id : Maybe String
    , tagName : String
    , classList : List String
    , elementId : Int
    , label : Maybe String
    , hasChildren : Bool
    , data : Maybe String
    }

type alias SelectionFilter =
    (String, String, String)

